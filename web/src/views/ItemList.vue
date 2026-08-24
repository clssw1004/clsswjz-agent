<template>
  <div class="item-list-page">
    <!-- 筛选条：月份 + 类型（为将来扩充分类/关键词/视图筛选预留容器） -->
    <Panel noPad>
      <div class="filter-bar">
        <div class="filter-month" @click="monthSheet = true">
          <el-icon :size="14"><Calendar /></el-icon>
          <span>{{ monthLabel }}</span>
        </div>
        <div class="type-switch">
          <button type="button" :class="{ on: typeFilter === '' }" @click="switchType('')">全部</button>
          <button type="button" :class="{ on: typeFilter === 'EXPENSE' }" @click="switchType('EXPENSE')">支出</button>
          <button type="button" :class="{ on: typeFilter === 'INCOME' }" @click="switchType('INCOME')">收入</button>
        </div>
      </div>
    </Panel>

    <!-- 列表容器（对齐移动端 ItemsContainer） -->
    <Panel title="账目明细" divider noPad>
      <template #head>
        <span v-if="total" class="list-total num">{{ total }} 条</span>
      </template>

      <div v-loading="initialLoading" class="list-body">
        <el-empty v-if="!initialLoading && !items.length" description="暂无符合条件的记录" />
        <div
          v-for="item in items"
          :key="item.id"
          class="list-item"
          @click="goDetail(item)"
        >
          <div class="deco-bar" :style="{ background: decoGrad(item.type) }"></div>
          <div class="item-main">
            <div class="item-row1">
              <span class="item-cat">{{ catName(item.categoryCode) || item.categoryCode || '未分类' }}</span>
              <span v-if="itemTags(item).length" class="item-tag">{{ itemTags(item).join(' · ') }}</span>
              <span class="item-amount num" :style="{ color: amountColor(item.type) }">
                {{ fmtAmount(item.amount) }}
              </span>
            </div>
            <div class="item-row2">
              <el-icon :size="13"><Clock /></el-icon>
              <span>{{ fullDate(item.accountDate) }}</span>
              <template v-if="shopName(item.shopCode)">
                <span class="row2-dot">·</span>
                <el-icon :size="13"><Shop /></el-icon>
                <span class="ellipsis">{{ shopName(item.shopCode) }}</span>
              </template>
            </div>
          </div>
          <el-dropdown trigger="click" @command="(cmd: string) => handleItemCmd(cmd, item)" @click.stop>
            <el-icon class="item-more"><MoreFilled /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">编辑</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 触底加载哨兵 -->
        <div ref="sentinel" class="list-sentinel">
          <span v-if="loadingMore" class="loading-hint"><i class="spinner"></i>加载中…</span>
          <span v-else-if="noMore && items.length" class="loading-hint end">没有更多了</span>
        </div>
      </div>
    </Panel>

    <!-- 月份选择弹层 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="monthSheet" class="sheet-mask" @click.self="monthSheet = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">选择月份</div>
            <el-date-picker
              v-model="monthValue"
              type="month"
              format="YYYY年M月"
              value-format="YYYY-MM"
              :clearable="false"
              class="sheet-month-picker"
              @change="monthSheet = false"
            />
            <button class="sheet-clear" @click="clearMonth">查看全部</button>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Calendar, Clock, Shop, MoreFilled } from '@element-plus/icons-vue';
import { itemApi, categoryApi, shopApi, tagApi } from '@/api';
import { useAppStore } from '@/stores/app';
import Panel from '@/components/Panel.vue';

const router = useRouter();
const app = useAppStore();

const now = new Date();
// 默认空 = 全部时间（移动端列表页默认显示全部账目，月份仅为可选筛选）
const monthValue = ref('');
const typeFilter = ref('');
const monthSheet = ref(false);

const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const initialLoading = ref(false);
const loadingMore = ref(false);
const noMore = ref(false);

const catMap = ref<Record<string, string>>({});
const shopMap = ref<Record<string, string>>({});
const tagMap = ref<Record<string, string>>({});

const monthLabel = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  return m ? `${m[1]}年${Number(m[2])}月` : '全部时间';
});

/** 空值 = 不过滤月份（查全部） */
const range = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    startDate: `${match[1]}-${match[2]}-01`,
    endDate: `${match[1]}-${match[2]}-${lastDay} 23:59:59`,
  };
});

const catName = (code?: string) => (code ? catMap.value[code] : '');
const shopName = (code?: string) => (code ? shopMap.value[code] : '');
const tagName = (code?: string) => (code ? tagMap.value[code] : '');
// 多标签显示：优先 item.tags（关联表），兼容历史 tagCode 单值
const itemTags = (item: any) => {
  if (Array.isArray(item.tags) && item.tags.length) {
    return item.tags.map((c: string) => tagMap.value[c] || c);
  }
  return item.tagCode ? [tagMap.value[item.tagCode] || item.tagCode] : [];
};

function fmtAmount(amount: number | string) {
  return (Number(amount) || 0).toFixed(2);
}

function amountColor(type?: string) {
  return type === 'INCOME' ? 'var(--amount-income)' : 'var(--amount-expense)';
}

function decoGrad(type?: string) {
  const c = type === 'INCOME' ? 'var(--amount-income)' : 'var(--amount-expense)';
  return `linear-gradient(180deg, ${c}, color-mix(in srgb, ${c} 20%, transparent))`;
}

function fullDate(d?: string) {
  return String(d || '').slice(0, 10);
}

async function loadMaps() {
  const bookId = app.currentBookId;
  const [cats, shps, tgs] = await Promise.all([
    categoryApi.list(bookId ? { accountBookId: bookId } : {}),
    shopApi.list(bookId ? { accountBookId: bookId } : {}),
    tagApi.list(bookId ? { accountBookId: bookId } : {}),
  ]);
  const catList: any[] = cats.items || cats || [];
  const shopList: any[] = shps.items || shps || [];
  const tagList: any[] = tgs.items || tgs || [];
  catMap.value = Object.fromEntries(catList.map((c) => [c.code, c.name]));
  shopMap.value = Object.fromEntries(shopList.map((s) => [s.code, s.name]));
  tagMap.value = Object.fromEntries(tagList.map((t) => [t.code, t.name]));
}

/** 首次加载（重置分页） */
async function reload() {
  page.value = 1;
  noMore.value = false;
  items.value = [];
  initialLoading.value = true;
  try {
    await loadPage(1, true);
  } finally {
    initialLoading.value = false;
  }
}

/** 加载一页（append=true 追加） */
async function loadPage(p: number, replace = false) {
  const res: any = await itemApi.list({
    accountBookId: app.currentBookId,
    page: p,
    pageSize,
    type: typeFilter.value || undefined,
    ...(range.value
      ? { startDate: range.value.startDate, endDate: range.value.endDate }
      : {}),
  });
  const list = res.items || [];
  total.value = res.total || 0;
  if (replace) {
    items.value = list;
  } else {
    items.value = [...items.value, ...list];
  }
  if (items.value.length >= total.value) noMore.value = true;
}

/** 触底加载下一页 */
async function loadMore() {
  if (initialLoading.value || loadingMore.value || noMore.value) return;
  if (items.value.length >= total.value) {
    noMore.value = true;
    return;
  }
  loadingMore.value = true;
  try {
    await loadPage(page.value + 1);
    page.value += 1;
  } catch {
    /* 忽略，下次触底重试 */
  } finally {
    loadingMore.value = false;
  }
}

function switchType(t: string) {
  if (typeFilter.value === t) return;
  typeFilter.value = t;
  reload();
}

function clearMonth() {
  monthValue.value = '';
  monthSheet.value = false;
}

function goDetail(item: any) {
  router.push(`/items/${item.id}`);
}

function handleItemCmd(cmd: string, item: any) {
  if (cmd === 'edit') {
    router.push(`/items/${item.id}`);
  } else if (cmd === 'delete') {
    ElMessageBox.confirm('确定删除这条记录吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(async () => {
      await itemApi.delete(item.id);
      items.value = items.value.filter((i) => i.id !== item.id);
      total.value = Math.max(0, total.value - 1);
      ElMessage.success('已删除');
    }).catch(() => {});
  }
}

/* 无限滚动：观察底部哨兵 */
let observer: IntersectionObserver | null = null;
const sentinel = ref<HTMLElement | null>(null);

onMounted(async () => {
  await Promise.all([loadMaps(), reload()]);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMore();
    },
    { rootMargin: '240px' },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});

onUnmounted(() => observer?.disconnect());

watch(monthValue, reload);
watch(() => app.currentBookId, () => {
  loadMaps();
  reload();
});
</script>

<style scoped>
.item-list-page {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

/* 筛选条（容器由 Panel 提供，仅保留内部布局） */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.filter-month {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass);
}

.type-switch {
  margin-left: auto;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.type-switch button {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-switch button.on {
  background: var(--grad-brand);
  color: var(--on-primary);
  font-weight: 600;
}

/* 列表 */
.list-total {
  font-size: 12px;
  color: var(--text-3);
}

.list-body {
  min-height: 60px;
  padding: 2px 0;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.list-item:hover {
  background: var(--surface-hover);
}

.list-item:active {
  background: var(--surface-active);
}

.item-more {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--text-3);
  padding: 4px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.item-more:hover {
  background: var(--surface-hover);
}

.deco-bar {
  width: 4px;
  height: 46px;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 2px;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.item-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-cat {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 5px;
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.item-amount {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
}

.item-row2 {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
  min-width: 0;
}

.item-row2 span.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.row2-dot {
  margin: 0 4px;
}

/* 触底加载 */
.list-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 16px;
  min-height: 20px;
}

.loading-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}

.loading-hint.end {
  color: var(--text-3);
  opacity: 0.7;
}

.spinner {
  width: 13px;
  height: 13px;
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

.sheet-month-picker {
  width: 100%;
}

.sheet-clear {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: 1px dashed var(--border-glass-strong);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--brand-gold);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.sheet-clear:hover {
  background: var(--brand-gold-soft);
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
</style>
