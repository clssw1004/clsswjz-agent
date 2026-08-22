<template>
  <div class="features-page">
    <!-- 账本数据组（标题 = 当前账本名，对齐移动端 FeatureHubBody） -->
    <section class="hub-group">
      <div class="hub-group-header">
        <el-icon :size="15"><Notebook /></el-icon>
        <span>{{ bookTitle }}</span>
      </div>
      <div class="hub-grid glass">
        <div v-for="f in bookItems" :key="f.label" class="hub-item" @click="go(f.route)">
          <div class="hub-icon" :style="{ background: f.grad }">
            <el-icon :size="20"><component :is="f.icon" /></el-icon>
          </div>
          <span class="hub-label">{{ f.label }}</span>
        </div>
      </div>
    </section>

    <!-- 生活组 -->
    <section class="hub-group">
      <div class="hub-group-header">
        <el-icon :size="15"><Sunny /></el-icon>
        <span>生活</span>
      </div>
      <div class="hub-grid glass">
        <div v-for="f in lifeItems" :key="f.label" class="hub-item" @click="go(f.route)">
          <div class="hub-icon" :style="{ background: f.grad }">
            <el-icon :size="20"><component :is="f.icon" /></el-icon>
          </div>
          <span class="hub-label">{{ f.label }}</span>
        </div>
      </div>
    </section>

    <!-- 数据工具组 -->
    <section class="hub-group">
      <div class="hub-group-header">
        <el-icon :size="15"><Setting /></el-icon>
        <span>数据工具</span>
      </div>
      <div class="hub-grid glass">
        <div v-for="f in toolItems" :key="f.label" class="hub-item" @click="go(f.route)">
          <div class="hub-icon" :style="{ background: f.grad }">
            <el-icon :size="20"><component :is="f.icon" /></el-icon>
          </div>
          <span class="hub-label">{{ f.label }}</span>
        </div>
        <div class="hub-item" @click="go('/settings/sync')">
          <div class="hub-icon" style="background: linear-gradient(135deg, #00a9c9, #38bdf8)">
            <el-icon :size="20"><Connection /></el-icon>
          </div>
          <span class="hub-label">同步设置</span>
        </div>
        <div class="hub-item" @click="handleSync">
          <div class="hub-icon" style="background: linear-gradient(135deg, #00a8d6, #38bdf8)">
            <el-icon :size="20"><RefreshRight /></el-icon>
          </div>
          <span class="hub-label">立即同步</span>
        </div>
        <div class="hub-item" @click="handleResync">
          <div class="hub-icon" style="background: linear-gradient(135deg, #64748b, #94a3b8)">
            <el-icon :size="20"><Refresh /></el-icon>
          </div>
          <span class="hub-label">全量重拉</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Notebook, CollectionTag, Shop, PriceTag, Folder, Wallet, Document, Sunny,
  Setting, RefreshRight, Refresh, Connection,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAppStore } from '@/stores/app';
import { useSyncStore } from '@/stores/sync';

const router = useRouter();
const app = useAppStore();
const sync = useSyncStore();

const bookTitle = computed(() => {
  const b = app.books.find((x: any) => x.id === app.currentBookId);
  return b?.name ? `${b.name} · 账本数据` : '账本数据';
});

const bookItems = [
  { label: '分类', icon: CollectionTag, grad: 'linear-gradient(135deg, #22a06b, #34d399)', route: '/settings/categories' },
  { label: '商户', icon: Shop, grad: 'linear-gradient(135deg, #e8528c, #f472b6)', route: '/settings/shops' },
  { label: '标签', icon: PriceTag, grad: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', route: '/settings/tags' },
  { label: '项目', icon: Folder, grad: 'linear-gradient(135deg, #e0a11a, #fbbf24)', route: '/settings/projects' },
  { label: '账户', icon: Wallet, grad: 'linear-gradient(135deg, #2e86de, #60a5fa)', route: '/settings/funds' },
  { label: '账本', icon: Notebook, grad: 'linear-gradient(135deg, #5c6bc0, #818cf8)', route: '/books' },
];

const lifeItems = [
  { label: '记事', icon: Document, grad: 'linear-gradient(135deg, #00a9c9, #22d3ee)', route: '/notes' },
];

const toolItems = [
  { label: '账本', icon: Notebook, grad: 'linear-gradient(135deg, #5c6bc0, #818cf8)', route: '/books' },
];

function go(route: string) {
  router.push(route);
}

function handleSync() {
  sync.triggerSync().then(() => {
    setTimeout(() => app.loadBooks(), 500);
    ElMessage.success('同步完成');
  });
}

async function handleResync() {
  if (sync.syncing) return;
  try {
    await ElMessageBox.confirm(
      '将重置同步游标并从服务端全量重拉所有数据（含分类、项目、标签等），过程中请勿关闭页面。是否继续？',
      '全量重拉',
      { type: 'warning', confirmButtonText: '开始重拉', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  sync.triggerResync().then(() => {
    setTimeout(() => app.loadBooks(), 500);
  });
}
</script>

<style scoped>
.features-page {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 20px;
}

.hub-group-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-gold);
  margin-bottom: 10px;
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
}

.hub-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
  aspect-ratio: 0.9;
  justify-content: center;
}

.hub-item:hover {
  background: var(--surface-hover);
  transform: translateY(-2px);
}

.hub-item:active {
  transform: scale(0.95);
}

.hub-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
}

.hub-label {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

@media (max-width: 480px) {
  .hub-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 10px 6px;
  }

  .hub-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
