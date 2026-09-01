<template>
  <div class="items-view">
    <!-- 统计卡：对齐移动端 BookStatisticCard -->
    <Panel :icon="Wallet" :title="monthLabel" accent>
      <template #head>
        <span class="stat-head-book">{{ currentBookName }}</span>
      </template>
      <template #action>
        <button class="stat-head-change" @click="monthSheet = true">切换</button>
      </template>
      <div class="stat-body">
        <div class="stat-item">
          <span class="stat-pill pill-expense">
            <el-icon :size="14"><ArrowDown /></el-icon>支出
          </span>
          <span class="stat-num num expense">{{ fmt(summary.expense) }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-pill pill-income">
            <el-icon :size="14"><ArrowUp /></el-icon>收入
          </span>
          <span class="stat-num num income">{{ fmt(summary.income) }}</span>
        </div>
      </div>
      <div class="stat-line"></div>
    </Panel>

    <!-- 列表卡片：对齐移动端 ItemsContainer（仅展示最新一天账目，"更多"进列表页） -->
    <Panel title="最近账目" divider noPad>
      <template #head>
        <span class="list-date">{{ lastDayLabel }}</span>
        <div v-if="!loading && items.length" class="list-stats">
          <span v-if="pageExpense < 0" class="mini-stat expense">
            <el-icon :size="13"><ArrowDown /></el-icon>{{ abs2(pageExpense) }}
          </span>
          <span v-if="pageExpense < 0 && pageIncome > 0" class="mini-sep">|</span>
          <span v-if="pageIncome > 0" class="mini-stat income">
            <el-icon :size="13"><ArrowUp /></el-icon>{{ pageIncome.toFixed(2) }}
          </span>
        </div>
      </template>
      <template #action>
        <span class="list-more" @click="goList">
          更多<el-icon :size="14"><ArrowRight /></el-icon>
        </span>
      </template>

      <div v-loading="loading" class="list-body">
        <el-empty v-if="!loading && items.length === 0" description="暂无账目，点中间加号记一笔" />

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
              <span>{{ timeOf(item) }}</span>
              <template v-if="shopName(item.shopCode)">
                <el-icon :size="13"><Shop /></el-icon>
                <span class="ellipsis">{{ shopName(item.shopCode) }}</span>
              </template>
              <template v-if="item.description">
                <span class="row2-dot">·</span>
                <el-icon :size="13"><Document /></el-icon>
                <span class="ellipsis">{{ item.description }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Panel>

    <!-- 统计组件（按 itemTabComponentOrder 配置化渲染，对齐 gui ItemsTab._buildOrderedComponents） -->
    <template v-for="key in componentOrder" :key="key">
      <DailyBarCard v-if="key === 'daily_bar'" :stats="dailyStats" />
      <DailyCalendarCard v-else-if="key === 'daily_calendar'" :stats="dailyStats" :month="monthValue" />
      <UserMonthlyCard v-else-if="key === 'user_monthly'" :users="userStats" />
      <ActivityRecentCard v-else-if="key === 'activity_recent'" />
      <DebtsCard v-else-if="key === 'debt'" />
      <PeriodStatusCard v-else-if="key === 'period_status'" />
    </template>

    <button class="fab" aria-label="新增记账" @click="router.push('/items/new')">+</button>

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
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Wallet, ArrowDown, ArrowUp, ArrowRight, Clock, Shop, Document } from '@element-plus/icons-vue';
import { itemApi, categoryApi, shopApi, tagApi } from '@/api';
import { useAppStore } from '@/stores/app';
import { usePrefsStore } from '@/stores/prefs';
import { useAuthStore } from '@/stores/auth';
import Panel from '@/components/Panel.vue';
import DailyBarCard from '@/components/stats/DailyBarCard.vue';
import DailyCalendarCard from '@/components/stats/DailyCalendarCard.vue';
import UserMonthlyCard from '@/components/stats/UserMonthlyCard.vue';
import ActivityRecentCard from '@/components/stats/ActivityRecentCard.vue';
import DebtsCard from '@/components/stats/DebtsCard.vue';
import PeriodStatusCard from '@/components/stats/PeriodStatusCard.vue';

const router = useRouter();
const app = useAppStore();
const prefs = usePrefsStore();
const auth = useAuthStore();

const now = new Date();
const monthValue = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
);
const monthSheet = ref(false);

const monthLabel = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  return m ? `${m[1]}年${Number(m[2])}月` : '';
});

// 拉到的最近一页（倒序），展示其中"最新一天"的账目（对齐移动端 lastDayItems）
const allItems = ref<any[]>([]);
const loading = ref(false);
const summary = ref({ income: 0, expense: 0 });

/** 最新账目日期（如 2026-08-22） */
const lastDay = computed(() =>
  allItems.value.length ? String(allItems.value[0].accountDate || '').slice(0, 10) : ''
);
const lastDayLabel = computed(() => {
  if (!lastDay.value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastDay.value);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : lastDay.value;
});

/** 最新一天的账目（首页容器展示内容） */
const items = computed(() =>
  lastDay.value
    ? allItems.value.filter((i) => String(i.accountDate || '').startsWith(lastDay.value))
    : []
);

// code → name 映射（分类/商户/标签）
const catMap = ref<Record<string, string>>({});
const shopMap = ref<Record<string, string>>({});
const tagMap = ref<Record<string, string>>({});

const currentBookName = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.name || ''
);

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

const pageExpense = computed(() =>
  items.value
    .filter((i) => i.type === 'EXPENSE')
    .reduce((s, i) => s + Number(i.amount || 0), 0)
);
const pageIncome = computed(() =>
  items.value
    .filter((i) => i.type === 'INCOME')
    .reduce((s, i) => s + Number(i.amount || 0), 0)
);

const range = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${match[1]}-${match[2]}-01`,
      endDate: `${match[1]}-${match[2]}-${lastDay} 23:59:59`, // 兼容带时间存储
    };
  }
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return {
    startDate: `${d.getFullYear()}-${mm}-01`,
    endDate: `${d.getFullYear()}-${mm}-${lastDay} 23:59:59`,
  };
});

// ========== 统计组件编排（对齐 gui UiConfigDTO.itemTabComponentOrder） ==========
/** gui 默认顺序：daily_bar → period_status → daily_calendar → user_monthly → activity_recent → debt */
const DEFAULT_ORDER = ['daily_bar', 'period_status', 'daily_calendar', 'user_monthly', 'activity_recent', 'debt'];
const componentOrder = computed(() => {
  const raw = prefs.get<string[]>('itemTabComponentOrder');
  if (Array.isArray(raw)) {
    const valid = raw.filter((k) =>
      ['daily_bar', 'daily_calendar', 'user_monthly', 'activity_recent', 'debt', 'period_status'].includes(k)
    );
    if (valid.length) return valid;
  }
  return DEFAULT_ORDER;
});

// ========== 当月账目（驱动柱状图/日历/成员统计；后端无按日/按用户聚合，前端内存聚合对齐 gui） ==========
const monthItems = ref<any[]>([]);
const monthLoading = ref(false);

/** 每日收支（对齐 gui DailyStatisticVO：仅当月有账目的日期，升序） */
const dailyStats = computed(() => {
  const map = new Map<string, { date: string; income: number; expense: number }>();
  for (const i of monthItems.value) {
    const d = String(i.accountDate || '').slice(0, 10);
    if (!d) continue;
    if (!map.has(d)) map.set(d, { date: d, income: 0, expense: 0 });
    const row = map.get(d)!;
    const amt = Number(i.amount || 0);
    if (i.type === 'INCOME') row.income += amt;
    else if (i.type === 'EXPENSE') row.expense += amt;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
});

/** 当月成员统计（对齐 gui getCurrentMonthUserStatistic：按 createdBy 分组，昵称映射当前用户） */
const userStats = computed(() => {
  const map = new Map<string, { userId: string; userName: string; income: number; expense: number; count: number }>();
  for (const i of monthItems.value) {
    const uid = String(i.createdBy || '');
    const key = uid || 'unknown';
    if (!map.has(key)) {
      const name =
        uid === auth.userId
          ? auth.nickname || '我'
          : uid
            ? `用户${uid.slice(-4)}`
            : '未知';
      map.set(key, { userId: uid, userName: name, income: 0, expense: 0, count: 0 });
    }
    const row = map.get(key)!;
    const amt = Number(i.amount || 0);
    if (i.type === 'INCOME') row.income += amt;
    else if (i.type === 'EXPENSE') row.expense += amt;
    row.count += 1;
  }
  return [...map.values()];
});

async function loadMonthItems() {
  if (!app.currentBookId) {
    monthItems.value = [];
    return;
  }
  monthLoading.value = true;
  try {
    const res: any = await itemApi.list({
      accountBookId: app.currentBookId,
      page: 1,
      pageSize: 1000,
      startDate: range.value.startDate,
      endDate: range.value.endDate,
    });
    monthItems.value = res.items || [];
  } catch {
    monthItems.value = [];
  } finally {
    monthLoading.value = false;
  }
}

/** 千位分隔 */
function fmt(n: number) {
  const v = Math.abs(Number(n) || 0);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function abs2(n: number) {
  return Math.abs(n).toFixed(2);
}

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

function timeOf(item: any) {
  const d = String(item.accountDate || '');
  return d.length > 10 ? d.slice(11, 16) : '--:--';
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

async function loadSummary() {
  try {
    const res: any = await itemApi.summary({
      accountBookId: app.currentBookId,
      startDate: range.value.startDate,
      endDate: range.value.endDate,
    });
    summary.value = { income: Number(res.income || 0), expense: Number(res.expense || 0) };
  } catch {
    summary.value = { income: 0, expense: 0 };
  }
}

/** 加载最近账目（不分月，倒序取一页，首页仅展示最新一天） */
async function loadRecent() {
  loading.value = true;
  try {
    const res: any = await itemApi.list({
      accountBookId: app.currentBookId,
      page: 1,
      pageSize: 50,
    });
    allItems.value = res.items || [];
  } catch {
    allItems.value = [];
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await Promise.all([loadRecent(), loadSummary(), loadMaps(), loadMonthItems()]);
}

function goList() {
  // 列表页默认显示全部账目，可按需筛选月份/类型
  router.push({ path: '/items/list' });
}

function goDetail(item: any) {
  router.push(`/items/${item.id}`);
}

onMounted(async () => {
  // 预载偏好（组件顺序），随后拉取首页数据
  if (!prefs.loaded) await prefs.load().catch(() => {});
  await reload();
});

// 月份切换只影响统计卡（列表始终为最近账目）
watch(monthValue, () => {
  loadSummary();
  loadMonthItems();
});

watch(
  () => app.currentBookId,
  () => {
    loadMaps();
    reload();
  }
);
</script>

<style scoped>
.items-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 88px;
  max-width: 860px;
  margin: 0 auto;
}

/* ========== 统计卡（对齐 BookStatisticCard，容器由 Panel 提供） ========== */
.stat-head-book {
  flex: 1;
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-head-change {
  border: none;
  background: transparent;
  color: var(--brand-gold);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
}

.stat-body {
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 18px 16px 16px;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.pill-expense {
  color: var(--amount-expense);
  background: rgba(185, 91, 75, 0.12);
}

.pill-income {
  color: var(--amount-income);
  background: rgba(67, 160, 71, 0.12);
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-num.expense {
  color: var(--amount-expense);
}

.stat-num.income {
  color: var(--amount-income);
}

.stat-divider {
  width: 1px;
  height: 44px;
  align-self: center;
  background: var(--border-glass);
}

/* 底部红绿渐变线 */
.stat-line {
  height: 2px;
  border-radius: 1px;
  margin: 0 16px 14px;
  background: linear-gradient(90deg, rgba(185, 91, 75, 0.5), rgba(67, 160, 71, 0.5));
}

/* ========== 列表卡片（对齐 ItemsContainer，容器由 Panel 提供） ========== */
.list-date {
  font-size: 11px;
  color: var(--text-3);
}

.list-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.mini-stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 500;
}

.mini-stat.expense {
  color: var(--amount-expense);
}

.mini-stat.income {
  color: var(--amount-income);
}

.mini-sep {
  color: var(--text-3);
}

.list-more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  padding: 4px 2px;
  border-radius: 6px;
  white-space: nowrap;
}

.list-more:hover {
  color: var(--brand-gold);
}

.list-body {
  min-height: 60px;
  padding: 2px 0;
}

.list-item {
  display: flex;
  align-items: stretch;
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

/* ========== 触底加载 ========== */
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

/* ========== FAB ========== */
.fab {
  position: fixed;
  right: 28px;
  bottom: 32px;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: var(--grad-brand);
  color: var(--on-primary);
  font-size: 30px;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--glow-primary);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 10;
}

.fab:hover {
  transform: scale(1.06);
}

.fab:active {
  transform: scale(0.94);
}

/* ========== 弹层 ========== */
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

@media (max-width: 767px) {
  .items-view {
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }

  /* 移动端新增入口由底部 tab 中间按钮提供，隐藏右下角 FAB */
  .fab {
    display: none;
  }

  .stat-num {
    font-size: 18px;
  }
}
</style>
