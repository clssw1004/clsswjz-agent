<template>
  <div class="app-layout">
    <!-- Desktop sidebar -->
    <aside v-if="!isMobile" class="sidebar glass">
      <div class="logo-area">
        <div class="logo-badge">
          <img class="logo-mark" :src="logoMark" alt="" />
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
          <!-- 账本切换胶囊（移动端记账 Tab，对齐原型 BookSelector：chip + 标题 + chevron） -->
          <button
            v-if="isMobile && showBookSelect"
            class="book-pill"
            @click="bookSheet = true"
          >
            <span class="book-chip" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="26" height="26" rx="8" fill="#E3ECFB"/>
                <rect x="8.5" y="5.5" width="9" height="15" rx="2" fill="#2E6BE5"/>
                <rect x="12.7" y="5.5" width="1.2" height="15" fill="#FFFFFF"/>
                <rect x="10.4" y="8.6" width="4.2" height="1.5" rx="0.75" fill="#FFFFFF"/>
                <rect x="10.4" y="11.8" width="4.2" height="1.5" rx="0.75" fill="#FFFFFF"/>
              </svg>
            </span>
            <span class="book-name">{{ currentBookName || '选择账本' }}</span>
            <svg class="book-chev" width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 1.5L6 6L10.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span v-else class="page-title">{{ route.meta.title || '记账' }}</span>
          <el-select
            v-if="showBookSelect && !isMobile"
            :model-value="app.currentBookId"
            class="global-book-select"
            placeholder="选择账本"
            size="small"
            @change="handleBookChange"
          >
            <el-option v-for="b in app.books" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </div>

        <!-- 桌面端才常驻同步/主题/用户（移动端右上角零常驻，对齐框架原型；同步入口在"我的"） -->
        <div v-if="!isMobile" class="topbar-right">
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
      <main class="content" :class="{ 'is-editor': isNoteEditor, 'is-bleed': isBleedPage }">
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

    <!-- 账本切换弹层（移动端，底部 sheet） -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="bookSheet" class="sheet-mask" @click.self="bookSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择账本</div>
            <div class="book-list">
              <button
                v-for="b in app.books"
                :key="b.id"
                class="book-row"
                :class="{ on: b.id === app.currentBookId }"
                @click="pickBook(b.id)"
              >
                <span class="book-dot" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="26" height="26" rx="8" fill="#E3ECFB"/>
                    <rect x="8.5" y="5.5" width="9" height="15" rx="2" fill="#2E6BE5"/>
                    <rect x="12.7" y="5.5" width="1.2" height="15" fill="#FFFFFF"/>
                    <rect x="10.4" y="8.6" width="4.2" height="1.5" rx="0.75" fill="#FFFFFF"/>
                    <rect x="10.4" y="11.8" width="4.2" height="1.5" rx="0.75" fill="#FFFFFF"/>
                  </svg>
                </span>
                <span class="book-row-name">{{ b.name }}</span>
                <el-icon v-if="b.id === app.currentBookId" class="book-check"><Check /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
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
  Check,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useSyncStore } from '@/stores/sync';
import { useResponsive } from '@/composables/useResponsive';
import { isDark, toggleMode } from '@/styles/themes';
import logoMark from '@/assets/logo-mark.png';

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

// 移动端账本切换弹层
const bookSheet = ref(false);
const currentBookName = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.name || ''
);
function pickBook(id: string) {
  app.switchBook(id);
  bookSheet.value = false;
}

// 记账 Tab 移动端通栏（内容区去内边距，页面自身为整版白板）
const isBleedPage = computed(() => isMobile.value && route.path === '/items');

// 子页面（新增/编辑详情/列表/账本/经期/设置）在顶栏显示返回（对齐移动端 AppBar leading 返回）
const isDetailPage = computed(() => /^\/(items\/(new|list|[^/]+)|notes\/(new|[^/]+)|books|periods|activities|vehicles|attachments|debts|fuel-records|db-viewer|settings\/)/.test(route.path));

// 记事编辑页：内容区改为沉浸式通栏（无外边距、无外部滚动，页面内部管理高度）
const isNoteEditor = computed(() => /^\/notes\/(new|[^/]+)$/.test(route.path));

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
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
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

/* GUI 的 app logo（猫），透明底；底色由上面的 var(--grad-brand) 提供，跟随主题 */
.logo-mark {
  width: 82%;
  height: 82%;
  object-fit: contain;
  display: block;
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
  min-height: 0;
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

/* ========== 账本切换胶囊（移动端记账 Tab AppBar，对齐原型 BookSelector） ========== */
.book-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 11px 0 5px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass-strong);
  border-radius: 18px;
  cursor: pointer;
  max-width: 68vw;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.book-pill:active {
  background: var(--surface-hover);
}

.book-chip {
  display: inline-flex;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
}

.book-chip svg {
  display: block;
  width: 26px;
  height: 26px;
}

.book-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-chev {
  flex-shrink: 0;
  color: var(--text-3);
}

/* ========== 账本切换弹层 ========== */
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
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
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
  margin-bottom: 12px;
}

.book-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 50vh;
  overflow-y: auto;
}

.book-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.book-row:active {
  background: var(--surface-hover);
}

.book-row.on {
  background: var(--brand-gold-soft);
}

.book-dot {
  display: inline-flex;
  flex-shrink: 0;
}

.book-row-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-check {
  color: var(--brand-gold);
  flex-shrink: 0;
}

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
  overflow-y: auto;
  min-height: 0;
}

/* 沉浸式编辑页（记事编辑）：关闭内容区自身滚动，交由页面内部管理高度，去外边距实现通栏 */
.content.is-editor {
  padding: 0;
  max-width: none;
  overflow: hidden;
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

  /* 记账 Tab 通栏：去内容区内边距，由页面自身渲染整版白板（对齐原型铺满式） */
  .content.is-bleed {
    padding: 0;
    max-width: none;
  }
}
</style>
