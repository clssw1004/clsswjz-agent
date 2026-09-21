<template>
  <div class="mine-page">
    <!-- 用户信息卡（对齐移动端 UserInfoCard，点击进用户详情） -->
    <div class="profile-card" @click="router.push('/user')">
      <div class="profile-bg"></div>
      <div class="profile-content">
        <div class="avatar">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" />
          <span v-else>{{ avatarText }}</span>
        </div>
        <div class="profile-info">
          <span class="profile-name">{{ auth.nickname || '未登录' }}</span>
          <span class="profile-sub mono">{{ shortUrl(auth.mainServerUrl) }}</span>
        </div>
        <el-icon class="tile-arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- 同步状态卡（独立组件，参考 gui 端 mine_tab.dart _buildCompactSyncRow：
         圆角 14 浅卡 + cloud 图标 + 状态文字 + 28x28 紧凑触发按钮 + 底部 2px LinearProgressIndicator。
         不嵌在 group-card / setting-tile 里，避免跟系统设置 tile 视觉混淆。
         用户 2026-09-10 决策：不显示"数据工具"分组标题；本身是一个完整进度条 UI） -->
    <div class="sync-card" :class="{ syncing: sync.syncing }" @click="handleSync">
      <div class="sync-card-row">
        <el-icon class="sync-card-icon" :size="16"><Cloudy /></el-icon>
        <span class="sync-card-text">{{ syncStatusText }}</span>
        <button
          class="sync-card-btn"
          type="button"
          :disabled="sync.syncing"
          :aria-label="sync.syncing ? '同步中' : '立即同步'"
          @click.stop="handleSync"
        >
          <el-icon v-if="!sync.syncing" :size="14"><Refresh /></el-icon>
          <span v-else class="sync-mini-spinner" aria-hidden="true"></span>
        </button>
      </div>
      <!-- 完整进度条 track（始终渲染；仅同步中填充宽度） -->
      <div class="sync-card-progress-track">
        <div class="sync-card-progress-bar" :style="{ width: `${sync.percent || 0}%` }"></div>
      </div>
    </div>

    <!-- 系统设置组（= 功能区；承接 gui 端"通用设置组 + 部分数据工具"：
         数据共享 / 数据库 / 界面布局 / 主题 / 关于 / 退出登录） -->
    <section class="mine-section">
      <div class="section-title">
        <el-icon :size="15"><Setting /></el-icon>
        <span>系统设置</span>
      </div>
      <div class="group-card glass">
        <!-- 数据共享（gui 端在通用设置组，本轮 2026-09-10 从"数据工具"挪入） -->
        <div class="setting-tile" @click="router.push('/settings/share')">
          <div class="tile-icon" style="background: linear-gradient(135deg, #3BA55D, #5BC07E)">
            <el-icon :size="17"><Share /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">数据共享</span>
            <span class="tile-sub">把车辆/加油/债务/活动/经期共享给家人</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="setting-tile" @click="router.push('/db-viewer')">
          <div class="tile-icon" style="background: linear-gradient(135deg, #06b6d4, #22d3ee)">
            <el-icon :size="17"><Coin /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">数据库</span>
            <span class="tile-sub">查看本地 SQLite 数据 · 只读</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <!-- 界面布局：恢复图标（之前 7e4a04d 误去图，本轮 2026-09-10 还原，对齐 gui dashboard_outlined #F97316） -->
        <div class="setting-tile" @click="router.push('/settings/ui')">
          <div class="tile-icon" style="background: linear-gradient(135deg, #F97316, #FB923C)">
            <el-icon :size="17"><Histogram /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">界面布局</span>
            <span class="tile-sub">记账 / 统计 / 我的页显示方式</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="setting-tile" @click="themeSheet = true">
          <div class="tile-icon" style="background: linear-gradient(135deg, #7c5cfc, #a78bfa)">
            <el-icon :size="17"><Brush /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">主题</span>
            <span class="tile-sub">{{ isDark ? '暗色' : '亮色' }} · {{ activeTheme.name }}</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="setting-tile" @click="aboutVisible = true">
          <div class="tile-icon" style="background: linear-gradient(135deg, #8a90a6, #a5b0c4)">
            <el-icon :size="17"><InfoFilled /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">关于</span>
            <span class="tile-sub">记账助手</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <!-- 退出登录（红色强调 token；恢复 SwitchButton 图标，本轮 2026-09-10 还原） -->
        <div class="setting-tile logout-tile" @click="handleLogout">
          <div class="tile-icon" style="background: linear-gradient(135deg, #ef4444, #f87171)">
            <el-icon :size="17"><SwitchButton /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label tile-label-danger">退出登录</span>
            <span class="tile-sub">清除本地会话，回到登录页</span>
          </div>
          <el-icon class="tile-arrow tile-arrow-danger"><ArrowRight /></el-icon>
        </div>
      </div>
    </section>

    <!-- 主题设置弹层 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="themeSheet" class="sheet-mask" @click.self="themeSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">主题设置</div>

            <div class="mode-row">
              <span class="mode-label">外观</span>
              <div class="mode-switch">
                <button type="button" :class="{ on: !isDark }" @click="setMode('light')">亮色</button>
                <button type="button" :class="{ on: isDark }" @click="setMode('dark')">暗色</button>
              </div>
            </div>

            <div class="color-label">主题色</div>
            <div class="color-grid">
              <button
                v-for="t in THEMES"
                :key="t.id"
                type="button"
                class="color-dot"
                :style="{ background: t.primary }"
                :class="{ on: activeThemeId === t.id }"
                :title="t.name"
                @click="setTheme(t.id)"
              ></button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 关于弹窗 -->
    <el-dialog v-model="aboutVisible" title="关于" width="320px" class="about-dialog">
      <div class="about-body">
        <div class="about-logo">
          <img class="logo-mark" :src="logoMark" alt="" />
        </div>
        <p class="about-name">记账助手</p>
        <p class="about-desc">清爽 · 专注 · 明细</p>
        <p class="about-version">Web 版</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Setting, Brush, InfoFilled, Share, Coin, ArrowRight, Refresh, Histogram, SwitchButton, Cloudy } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { useAppStore } from '@/stores/app';
import { loadAttachmentUrl, userApi } from '@/api';
import { THEMES, activeTheme, activeThemeId, isDark, setMode, setTheme } from '@/styles/themes';
import logoMark from '@/assets/logo-mark.png';

const router = useRouter();
const auth = useAuthStore();
const sync = useSyncStore();

const themeSheet = ref(false);
const aboutVisible = ref(false);
const avatarUrl = ref('');

const avatarText = computed(() => (auth.nickname || 'U').slice(0, 1).toUpperCase());

/** 同步状态摘要（对齐 AppBar 同步按钮的文案规则） */
const syncStatusText = computed(() => {
  if (sync.syncing) return sync.step ? `${sync.step}${sync.percent ? ` ${sync.percent}%` : ''}` : '同步中...';
  return sync.unsynced > 0 ? `${sync.unsynced} 条待同步，点击立即同步` : '数据已同步';
});

/** 手动触发同步（对齐 AppBar handleSync：完成后刷新账本列表） */
function handleSync() {
  if (sync.syncing) return;
  sync.triggerSync().then(() => {
    setTimeout(() => useAppStore().loadBooks(), 500);
  });
}

/** 拉头像：带鉴权懒加载（<img> 直接请求会 401，用 fetch + token 拿 blob） */
async function loadAvatar() {
  try {
    const res: any = await userApi.profile();
    const p = res?.data ?? res ?? {};
    if (p.avatar) {
      avatarUrl.value = await loadAttachmentUrl(p.avatar);
    }
  } catch { /* ignore */ }
}

function shortUrl(url?: string) {
  if (!url) return '未连接主端';
  try {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  sync.stopPolling();
  auth.logout();
}

onMounted(() => {
  auth.fetchMe();
  loadAvatar();
});
</script>

<style scoped>
.mine-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

/* 同步中图标旋转 */
.tile-icon .is-loading {
  animation: mine-spin 0.8s linear infinite;
}

/* 同步状态卡（独立组件，参考 gui _buildCompactSyncRow；圆角 14 + 紧凑 row + 底部 2px 进度条） */
.sync-card {
  position: relative;
  border-radius: 14px;
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  padding: 10px 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.sync-card:hover {
  border-color: var(--border-glass-strong);
}
.sync-card.syncing {
  border-color: var(--brand-gold);
  background: var(--surface-glass-strong);
}

.sync-card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.sync-card-icon {
  color: var(--text-2);
  flex-shrink: 0;
  transition: color 0.2s ease;
}
.sync-card.syncing .sync-card-icon {
  color: var(--brand-gold);
}

.sync-card-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.sync-card.syncing .sync-card-text {
  font-weight: 600;
}

.sync-card-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: var(--surface-active);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}
.sync-card-btn:hover:not(:disabled) {
  background: var(--grad-brand);
  color: var(--on-primary);
}
.sync-card-btn:disabled {
  opacity: 0.75;
  cursor: default;
}

/* 同步中按钮内的迷你转圈（12×12 spinner；独立卡片里尺寸小一点） */
.sync-mini-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: mine-spin 0.6s linear infinite;
  display: inline-block;
}

/* 完整进度条：track 始终渲染（2px 圆角），仅同步中 bar 填充宽度
   对齐 gui LinearProgressIndicator minHeight:2 + borderRadius:2 */
.sync-card-progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--surface-active);
  overflow: hidden;
}
.sync-card-progress-bar {
  height: 100%;
  background: var(--grad-brand);
  transition: width 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
  border-radius: 0 2px 2px 0;
}

@keyframes mine-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 用户信息卡 */
.profile-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.profile-card:hover {
  border-color: var(--border-glass-strong);
}

.profile-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(300px 160px at 8% -20%, var(--bg-glow-gold), transparent 60%),
    radial-gradient(300px 180px at 100% 120%, var(--bg-glow-purple), transparent 55%);
  pointer-events: none;
}

.profile-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 20px;
}

.avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.profile-sub {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 分组 */
.mine-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-gold);
  padding: 0 4px;
}

.group-card.glass {
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.setting-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

/* 无图标 tile 视觉补偿（本轮 2026-09-10 已撤销；保留 .no-icon 选择器作为占位，避免外部 class 触发样式塌缩） */
.setting-tile.no-icon .tile-label {
  font-size: 16px;
}

.setting-tile:hover {
  background: var(--surface-hover);
}

.setting-tile + .setting-tile {
  border-top: 1px solid var(--border-glass);
}

.tile-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
}

.tile-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.tile-sub {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-arrow {
  color: var(--text-3);
  font-size: 14px;
  flex-shrink: 0;
}

/* 退出登录 tile（红色强调 token；原来是页底独立按钮，2026-09-10 决策合并进数据工具组下方） */
.logout-tile {
  --tile-accent: #ef4444;
}
.tile-label-danger {
  color: var(--tile-accent);
}
.tile-arrow-danger {
  color: var(--tile-accent);
  opacity: 0.7;
}
.logout-tile:hover .tile-arrow-danger {
  opacity: 1;
}

/* 弹层 */
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(4, 8, 18, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 480px;
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  padding: 10px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-pop);
}

.sheet-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-3);
  opacity: 0.4;
  margin: 4px auto 14px;
}

.sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 16px;
}

.mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.mode-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.mode-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.mode-switch button {
  border: none;
  background: transparent;
  padding: 5px 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-switch button.on {
  background: var(--grad-brand);
  color: var(--on-primary);
  font-weight: 600;
}

.color-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 10px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 10px;
}

.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
  justify-self: center;
}

.color-dot:hover {
  transform: scale(1.12);
}

.color-dot.on {
  border-color: var(--text-1);
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4);
}

html.dark .color-dot.on {
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.4);
}

/* 关于 */
.about-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
}

.about-logo {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 17px;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  margin-bottom: 6px;
}

/* GUI 的 app logo（猫），透明底；底色由上面的 var(--grad-brand) 提供，跟随主题 */
.logo-mark {
  width: 82%;
  height: 82%;
  object-fit: contain;
  display: block;
}

.about-name {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
}

.about-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

.about-version {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-3);
}

/* 弹层过渡 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
