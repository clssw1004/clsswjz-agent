<template>
  <div class="mine-page">
    <!-- 用户信息卡（对齐移动端 UserInfoCard） -->
    <div class="profile-card">
      <div class="profile-bg"></div>
      <div class="profile-content">
        <div class="avatar">{{ avatarText }}</div>
        <div class="profile-info">
          <span class="profile-name">{{ auth.nickname || '未登录' }}</span>
          <span class="profile-sub mono">{{ shortUrl(auth.mainServerUrl) }}</span>
        </div>
      </div>
    </div>

    <!-- 系统设置组（对齐移动端 GeneralSettings） -->
    <section class="mine-section">
      <div class="section-title">
        <el-icon :size="15"><Setting /></el-icon>
        <span>系统设置</span>
      </div>
      <div class="group-card glass">
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
      </div>
    </section>

    <!-- 数据工具组（对齐移动端 DataSettings） -->
    <section class="mine-section">
      <div class="section-title">
        <el-icon :size="15"><Tools /></el-icon>
        <span>数据工具</span>
      </div>
      <div class="group-card glass">
        <div class="setting-tile" @click="router.push('/settings/sync')">
          <div class="tile-icon" style="background: linear-gradient(135deg, #00a9c9, #38bdf8)">
            <el-icon :size="17"><Connection /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">同步设置</span>
            <span class="tile-sub">服务器与账号 · 数据管理</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="setting-tile" @click="router.push('/settings/share')">
          <div class="tile-icon" style="background: linear-gradient(135deg, #f472b6, #ec4899)">
            <el-icon :size="17"><Share /></el-icon>
          </div>
          <div class="tile-main">
            <span class="tile-label">数据共享</span>
            <span class="tile-sub">把车辆/加油/债务/活动/经期共享给家人</span>
          </div>
          <el-icon class="tile-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </section>

    <!-- 退出登录 -->
    <button class="logout-btn" @click="handleLogout">退出登录</button>

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
        <div class="about-logo">记</div>
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
import { Setting, Brush, InfoFilled, Tools, Connection, Share, ArrowRight } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { THEMES, activeTheme, activeThemeId, isDark, setMode, setTheme } from '@/styles/themes';

const router = useRouter();
const auth = useAuthStore();
const sync = useSyncStore();

const themeSheet = ref(false);
const aboutVisible = ref(false);

const avatarText = computed(() => (auth.nickname || 'U').slice(0, 1).toUpperCase());

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

/* 用户信息卡 */
.profile-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
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

/* 退出登录 */
.logout-btn {
  width: 100%;
  padding: 13px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-md);
  background: var(--surface-glass);
  color: var(--brand-red);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.07);
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
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  margin-bottom: 6px;
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
