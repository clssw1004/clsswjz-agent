<template>
  <div class="app-layout">
    <!-- Desktop sidebar -->
    <aside v-if="!isMobile" class="sidebar glass">
      <div class="logo-area">
        <div class="logo-badge">
          <el-icon :size="20"><Coin /></el-icon>
        </div>
        <div class="logo-text">
          <span class="logo-title">记账助手</span>
          <span class="logo-sub">清爽 · 专注 · 明细</span>
        </div>
      </div>

      <el-menu :default-active="route.path" router class="side-menu">
        <el-menu-item index="/items">
          <el-icon><Wallet /></el-icon>
          <span>记账</span>
        </el-menu-item>
        <el-menu-item index="/features">
          <el-icon><Grid /></el-icon>
          <span>功能</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><Histogram /></el-icon>
          <span>统计</span>
        </el-menu-item>
        <el-menu-item index="/notes">
          <el-icon><Document /></el-icon>
          <span>记事</span>
        </el-menu-item>
        <el-menu-item index="/mine">
          <el-icon><User /></el-icon>
          <span>我的</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-foot">
        <div class="user-chip">
          <div class="avatar">{{ avatarText }}</div>
          <div class="user-meta">
            <span class="user-name">{{ auth.nickname || '未登录' }}</span>
            <span class="user-sub">点击右上角退出</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar glass">
        <div class="topbar-left">
          <button v-if="isDetailPage" class="back-btn" aria-label="返回" @click="goBack">
            <el-icon :size="18"><ArrowLeft /></el-icon>
          </button>
          <span class="page-title">{{ route.meta.title || '记账' }}</span>
          <el-select
            v-if="showBookSelect"
            :model-value="app.currentBookId"
            class="global-book-select"
            placeholder="选择账本"
            size="small"
            @change="handleBookChange"
          >
            <el-option v-for="b in app.books" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </div>

        <div class="topbar-right">
          <!-- 同步状态（移动端紧凑图标，桌面端文字行） -->
          <button class="sync-btn" :disabled="sync.syncing" @click="handleSync" :title="syncTitle">
            <span v-if="sync.syncing" class="sync-spinner"></span>
            <el-icon v-else-if="sync.unsynced > 0" class="sync-icon pending"><UploadFilled /></el-icon>
            <el-icon v-else class="sync-icon ok"><CircleCheckFilled /></el-icon>
            <span v-if="!isMobile" class="sync-label">
              <template v-if="sync.syncing">{{ sync.step || '同步中...' }}{{ sync.percent ? ` ${sync.percent}%` : '' }}</template>
              <template v-else-if="sync.unsynced > 0">待同步 {{ sync.unsynced }} 条</template>
              <template v-else>已同步</template>
            </span>
            <span v-if="sync.unsynced > 0" class="sync-badge">{{ sync.unsynced }}</span>
          </button>

          <el-tooltip :content="isDark ? '切换亮色' : '切换暗色'" placement="bottom">
            <button class="icon-btn" @click="toggleMode">
              <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            </button>
          </el-tooltip>

          <el-dropdown v-if="auth.nickname" @command="handleCommand">
            <span class="user-name">{{ auth.nickname }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- Content -->
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Mobile bottom tabs（对齐移动端：记账 | 功能 | 新增 | 统计 | 我的；新增为中间圆形按钮） -->
      <nav v-if="isMobile && !isDetailPage" class="bottom-tabs glass">
        <router-link to="/items" class="tab" :class="{ active: route.path.startsWith('/items') }">
          <el-icon :size="20"><Wallet /></el-icon>
          <span>记账</span>
        </router-link>
        <router-link to="/features" class="tab" :class="{ active: route.path.startsWith('/features') }">
          <el-icon :size="20"><Grid /></el-icon>
          <span>功能</span>
        </router-link>
        <button class="tab-add" aria-label="新增记账" @click="router.push('/items/new')">
          <span class="tab-add-circle"><el-icon :size="22"><Plus /></el-icon></span>
        </button>
        <router-link to="/statistics" class="tab" :class="{ active: route.path.startsWith('/statistics') }">
          <el-icon :size="20"><Histogram /></el-icon>
          <span>统计</span>
        </router-link>
        <router-link to="/mine" class="tab" :class="{ active: route.path.startsWith('/mine') }">
          <el-icon :size="20"><User /></el-icon>
          <span>我的</span>
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Coin,
  Wallet,
  Document,
  User,
  UploadFilled,
  CircleCheckFilled,
  Moon,
  Sunny,
  SwitchButton,
  Grid,
  Histogram,
  ArrowLeft,
  Plus,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useSyncStore } from '@/stores/sync';
import { useResponsive } from '@/composables/useResponsive';
import { isDark, toggleMode } from '@/styles/themes';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const app = useAppStore();
const sync = useSyncStore();
const { isMobile } = useResponsive();

const avatarText = computed(() => (auth.nickname || 'U').slice(0, 1).toUpperCase());

const syncTitle = computed(() =>
  sync.syncing
    ? '同步中'
    : sync.unsynced > 0
      ? `${sync.unsynced} 条待同步，点击同步`
      : '数据已同步',
);

onMounted(() => {
  app.bootstrap();
  sync.startPolling();
});

onUnmounted(() => {
  sync.stopPolling();
});

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    sync.stopPolling();
    auth.logout();
  }
}

/** 全局切换账本：刷新当前页面数据（各视图 watch currentBookId 自动重载） */
function handleBookChange(id: string) {
  app.switchBook(id);
}

// 账本选择仅首页展示（对齐移动端：首页/记账页才切账本）
const showBookSelect = computed(() => route.path === '/items');

// 子页面（新增/编辑详情/列表/账本/经期/设置）在顶栏显示返回（对齐移动端 AppBar leading 返回）
const isDetailPage = computed(() => /^\/(items\/(new|list|[^/]+)|notes\/(new|[^/]+)|books|periods|activities|vehicles|fuel-records|db-viewer|settings\/)/.test(route.path));

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push('/items');
}

function handleSync() {
  sync.triggerSync().then(() => {
    setTimeout(() => app.loadBooks(), 500);
  });
}
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  position: relative;
}

/* ========== 桌面侧栏 ========== */
.sidebar {
  width: 224px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 12px 16px;
  background: var(--side-bg);
  border-right: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  z-index: 20;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px 22px;
}

.logo-badge {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #fff;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.logo-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
}

.logo-sub {
  font-size: 11px;
  color: var(--text-3);
}

.side-menu {
  border-right: none;
  background: transparent;
  flex: 1;
}

.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  border-radius: var(--radius-md);
  margin: 2px 0;
  font-weight: 500;
}

.side-menu :deep(.el-menu-item) {
  display: flex;
  align-items: center;
  gap: 10px;
}

.side-menu :deep(.el-menu-item.is-active) {
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
  font-weight: 600;
}

.side-menu :deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  border-radius: 4px;
  background: var(--brand-gold);
}

.sidebar-foot {
  padding: 14px 6px 0;
  border-top: 1px solid var(--border-glass);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-md);
  background: var(--surface-glass);
}

.avatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  background: var(--grad-purple);
}

.user-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-sub {
  font-size: 11px;
  color: var(--text-3);
}

/* ========== 主区域 ========== */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  z-index: 1;
}

/* ========== 顶栏 ========== */
.topbar {
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

/* AppBar 返回（对齐移动端 leading 返回箭头） */
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--surface-glass-strong);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--surface-hover);
}

.global-book-select {
  width: 160px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-2);
  transition: all var(--transition-base);
  position: relative;
}

.sync-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-glass-strong);
}

.sync-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.sync-icon {
  font-size: 15px;
}

.sync-icon.pending {
  color: var(--brand-gold);
}

.sync-icon.ok {
  color: var(--color-success);
}

.sync-label {
  white-space: nowrap;
}

.sync-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--brand-gold);
  color: var(--on-primary);
  font-size: 10px;
  font-weight: 700;
}

.sync-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-glass-strong);
  border-top-color: var(--brand-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-glass);
  background: var(--surface-glass-strong);
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--transition-base);
}

.icon-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-gold);
  border-color: var(--border-glass-strong);
}

.icon-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.user-name {
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-left: 4px;
}

/* ========== 内容区 ========== */
.content {
  flex: 1;
  padding: 16px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ========== 页面过渡 ========== */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ========== 移动端底部导航 ========== */
.bottom-tabs {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(58px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface-glass-strong);
  border-top: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  z-index: 100;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--text-3);
  text-decoration: none;
  font-size: 11px;
  transition: color var(--transition-base);
  position: relative;
}

.tab.active {
  color: var(--brand-gold);
  font-weight: 600;
}

.tab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--grad-brand);
}

/* 中间新增按钮（对齐移动端 NavigationBar 中央圆形 FAB） */
.tab-add {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  position: relative;
}

.tab-add-circle {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--on-primary);
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  margin-top: -22px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tab-add-circle:active {
  transform: scale(0.92);
}

/* ========== 响应式 ========== */
@media (max-width: 1023px) {
  .topbar {
    padding: 0 14px;
  }

  .page-title {
    font-size: 15px;
  }

  .global-book-select {
    width: 130px;
  }
}

@media (max-width: 767px) {
  .topbar {
    height: 52px;
    padding: 0 12px;
  }

  .topbar-left {
    gap: 10px;
  }

  .global-book-select {
    width: 116px;
  }

  .topbar-right {
    gap: 6px;
  }

  .sync-btn {
    padding: 6px 9px;
  }

  .content {
    padding: 20px 12px calc(76px + env(safe-area-inset-bottom));
  }
}
</style>
