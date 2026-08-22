<template>
  <div class="app-layout">
    <!-- Desktop sidebar -->
    <aside v-if="!isMobile" class="sidebar glass">
      <div class="logo">记账助手</div>
      <el-menu :default-active="route.path" router class="side-menu">
        <el-menu-item index="/items">记账</el-menu-item>
        <el-menu-item index="/books">账本</el-menu-item>
        <el-menu-item index="/notes">记事</el-menu-item>
        <el-sub-menu index="settings">
          <template #title>设置</template>
          <el-menu-item index="/settings/categories">分类</el-menu-item>
          <el-menu-item index="/settings/shops">商户</el-menu-item>
          <el-menu-item index="/settings/tags">标签</el-menu-item>
          <el-menu-item index="/settings/projects">项目</el-menu-item>
          <el-menu-item index="/settings/funds">账户</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </aside>

    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar glass">
        <span class="page-title">{{ route.meta.title || '记账' }}</span>
        <el-dropdown v-if="auth.nickname" @command="handleCommand">
          <span class="user-name">{{ auth.nickname }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>

      <!-- Content -->
      <main class="content">
        <router-view />
      </main>

      <!-- Mobile bottom tabs -->
      <nav v-if="isMobile" class="bottom-tabs glass">
        <router-link to="/items" class="tab" :class="{ active: route.path.startsWith('/items') }">记账</router-link>
        <router-link to="/books" class="tab" :class="{ active: route.path.startsWith('/books') }">账本</router-link>
        <router-link to="/notes" class="tab" :class="{ active: route.path.startsWith('/notes') }">记事</router-link>
        <router-link to="/settings/funds" class="tab" :class="{ active: route.path.startsWith('/settings') }">我的</router-link>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import { useResponsive } from '@/composables/useResponsive';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const app = useAppStore();
const { isMobile } = useResponsive();

onMounted(() => {
  app.loadBooks();
});

function handleCommand(cmd: string) {
  if (cmd === 'logout') {
    auth.logout();
  }
}
</script>

<style scoped>
.app-layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 200px; padding: 16px 8px;
  background: var(--surface-glass); border-right: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
}
.logo { font-size: 18px; font-weight: 700; color: var(--text-1); text-align: center; padding: 12px 0 20px; }
.side-menu { border-right: none; background: transparent; }
.main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  height: 52px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; background: var(--surface-glass);
  border-bottom: 1px solid var(--border-glass); backdrop-filter: var(--blur-glass);
}
.page-title { font-size: 16px; font-weight: 600; color: var(--text-1); }
.user-name { color: var(--text-2); cursor: pointer; font-size: 14px; }
.content { flex: 1; padding: 20px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.bottom-tabs {
  display: flex; position: fixed; bottom: 0; left: 0; right: 0; height: 56px;
  background: var(--surface-glass-strong); border-top: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass); z-index: 100;
}
.tab {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: var(--text-3); text-decoration: none; font-size: 13px;
}
.tab.active { color: var(--brand-gold); font-weight: 600; }
@media (max-width: 767px) {
  .content { padding: 12px 12px 72px; }
}
</style>
