<template>
  <div class="items-view">
    <!-- 月度概览（对齐原型 MonthOverview：月份切换 + 支出主视觉 + 收入/结余） -->
    <section class="month-overview">
      <div class="mo-head">
        <div class="mo-nav">
          <button class="mo-arrow" aria-label="上月" @click="shiftMonth(-1)">
            <el-icon :size="14"><ArrowLeft /></el-icon>
          </button>
          <button class="mo-title" @click="monthSheet = true">{{ monthShortLabel }}</button>
          <button class="mo-arrow" aria-label="下月" @click="shiftMonth(1)">
            <el-icon :size="14"><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
      <div class="mo-stats">
        <div class="mo-main">
          <span class="mo-label">支出</span>
          <span class="mo-num expense">¥{{ fmt(summary.expense) }}</span>
        </div>
        <div class="mo-side">
          <div class="mo-col">
            <span class="mo-label">收入</span>
            <span class="mo-val income">+¥{{ fmt(summary.income) }}</span>
          </div>
          <div class="mo-vdiv"></div>
          <div class="mo-col">
            <span class="mo-label">结余</span>
            <span class="mo-val balance">{{ balanceStr }}</span>
          </div>
        </div>
      </div>
    </section>

    <div class="sheet-divider"></div>

    <!-- 最近一天明细（对齐原型：当日小计 + 全部账目入口 + 分类彩色头像行） -->
    <section class="day-list">
      <div class="day-head">
        <div class="day-head-left">
          <span class="day-label">{{ lastDayLabel }}</span>
          <span v-if="!loading && items.length" class="day-sum">支出 ¥{{ fmt(pageExpense) }}</span>
        </div>
        <button class="day-more" @click="goList">
          全部账目<el-icon :size="12"><ArrowRight /></el-icon>
        </button>
      </div>

      <div v-loading="loading" class="day-body">
        <el-empty v-if="!loading && items.length === 0" description="暂无账目，点中间加号记一笔" />

        <!-- 精致账目行：左侧 4px 分类色条 + 描述/分类/时间 + 右侧金额（无图标，对齐移动端"无图标就去掉"约定） -->
        <div v-for="item in items" :key="item.id" class="day-row" @click="goDetail(item)">
          <span class="row-bar" :style="{ background: catColor(item) }" aria-hidden="true"></span>
          <div class="row-main">
            <div class="row-line1">
              <span class="row-name">{{ rowTitle(item) }}</span>
              <span v-if="catName(item.categoryCode)" class="row-cat-tag" :style="{ color: catColor(item) }">
                {{ catName(item.categoryCode) }}
              </span>
            </div>
            <span class="row-sub">{{ rowSub(item) }}</span>
          </div>
          <span class="row-amount" :class="item.type === 'INCOME' ? 'income' : 'expense'">
            {{ item.type === 'INCOME' ? '+' : '-' }}¥{{ fmtAmount(Math.abs(Number(item.amount) || 0)) }}
          </span>
        </div>
      </div>
    </section>

    <!-- 统计组件（按 itemTabComponentOrder 配置化渲染，对齐 gui ItemsTab._buildOrderedComponents） -->
    <template v-for="key in componentOrder" :key="key">
      <DailyBarCard v-if="key === 'daily_bar'" :stats="dailyStats" :month="monthValue" />
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
import {
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue';
import { itemApi, categoryApi, shopApi, userApi } from '@/api';
import { useAppStore } from '@/stores/app';
import { usePrefsStore } from '@/stores/prefs';
import { useAuthStore } from '@/stores/auth';
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

/** 月份短标题：当年只显「9月」，跨年带年份（对齐原型 MonthTitle） */
const monthShortLabel = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (!m) return '';
  return Number(m[1]) === now.getFullYear()
    ? `${Number(m[2])}月`
    : `${m[1]}年${Number(m[2])}月`;
});

/** 左右箭头切月（对齐原型 MonthNav） */
function shiftMonth(delta: number) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (!m) return;
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1);
  monthValue.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 拉到的最近一页（倒序），展示其中"最新一天"的账目（对齐移动端 lastDayItems）
const allItems = ref<any[]>([]);
const loading = ref(false);
const summary = ref({ income: 0, expense: 0 });

/** 最新账目日期（如 2026-08-22） */
const lastDay = computed(() =>
  allItems.value.length ? String(allItems.value[0].accountDate || '').slice(0, 10) : ''
);
const lastDayLabel = computed(() => (lastDay.value ? fmtDayLabel(lastDay.value) : ''));

/** 友好日期标签：今天/昨天 + M月D日 周X（对齐原型 GroupLabel） */
function fmtDayLabel(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const base = `${Number(m[2])}月${Number(m[3])}日 周${week}`;
  if (diff === 0) return `今天 · ${base}`;
  if (diff === 1) return `昨天 · ${base}`;
  return base;
}

/** 最新一天的账目（首页容器展示内容） */
const items = computed(() =>
  lastDay.value
    ? allItems.value.filter((i) => String(i.accountDate || '').startsWith(lastDay.value))
    : []
);

// code → name 映射（分类/商户）
const catMap = ref<Record<string, string>>({});
const shopMap = ref<Record<string, string>>({});

const catName = (code?: string) => (code ? catMap.value[code] : '');
const shopName = (code?: string) => (code ? shopMap.value[code] : '');

const pageExpense = computed(() =>
  items.value
    .filter((i) => i.type === 'EXPENSE')
    .reduce((s, i) => s + Number(i.amount || 0), 0)
);

/** 结余 = 收入 - 支出（对齐原型 BalanceCol） */
const balanceStr = computed(() => {
  const v = summary.value.income - summary.value.expense;
  return `${v >= 0 ? '+' : '-'}¥${fmt(v)}`;
});

// ========== 分类色（10 色调色板 + hashCode 取色，给左侧 4px 条 + 分类标签用，同 note_tile 规律） ==========
const PALETTE = [
  '#5C6BC0', '#26A69A', '#FF7043', '#AB47BC', '#42A5F5',
  '#66BB6A', '#EC407A', '#FFA726', '#26C6DA', '#8D6E63',
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function catColor(item: any) {
  const key = String(item.categoryCode || item.categoryId || catName(item.categoryCode) || 'x');
  return PALETTE[hashStr(key) % PALETTE.length];
}

function rowTitle(item: any) {
  return item.description?.trim() || catName(item.categoryCode) || item.categoryCode || '未分类';
}

function rowSub(item: any) {
  const cat = catName(item.categoryCode) || item.categoryCode || '未分类';
  const shop = shopName(item.shopCode);
  return shop ? `${cat} · ${timeOf(item)} · ${shop}` : `${cat} · ${timeOf(item)}`;
}

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
const ALL_KEYS = ['daily_bar', 'daily_calendar', 'user_monthly', 'activity_recent', 'debt', 'period_status'];
const componentOrder = computed(() => {
  const raw = prefs.get<string[]>('itemTabComponentOrder');
  if (Array.isArray(raw)) {
    const valid = raw.filter((k) => ALL_KEYS.includes(k));
    if (valid.length) return valid;
  }
  return DEFAULT_ORDER;
});

// ========== 当月账目（驱动柱状图/日历/成员统计；后端无按日/按用户聚合，前端内存聚合对齐 gui） ==========
const monthItems = ref<any[]>([]);
const monthLoading = ref(false);
/** 他人 userId → 昵称（对齐 gui id2name：查本地 userTable；失败回退「用户{id后4位}」） */
const userNameMap = ref<Record<string, string>>({});

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
            ? userNameMap.value[uid] || `用户${uid.slice(-4)}`
            : '未知';
      map.set(key, { userId: uid, userName: name, income: 0, expense: 0, count: 0 });
    }
    const row = map.get(key)!;
    const amt = Math.abs(Number(i.amount || 0));
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
    await resolveUserNames();
  } catch {
    monthItems.value = [];
  } finally {
    monthLoading.value = false;
  }
}

/** 解析当月账目中他人的昵称（对齐 gui id2name：查本地 userTable；失败不阻断统计展示） */
async function resolveUserNames() {
  const ids = [...new Set(
    monthItems.value.map((i) => String(i.createdBy || '')).filter((id) => id && id !== auth.userId)
  )];
  if (!ids.length) return;
  try {
    const res: any = await userApi.nicknames(ids);
    if (res && typeof res === 'object') userNameMap.value = { ...userNameMap.value, ...res };
  } catch {
    // 解析失败则回退「用户{id后4位}」
  }
}

/** 千位分隔 */
function fmt(n: number) {
  const v = Math.abs(Number(n) || 0);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAmount(amount: number | string) {
  return (Number(amount) || 0).toFixed(2);
}

function timeOf(item: any) {
  const d = String(item.accountDate || '');
  return d.length > 10 ? d.slice(11, 16) : '--:--';
}

async function loadMaps() {
  const bookId = app.currentBookId;
  const [cats, shps] = await Promise.all([
    categoryApi.list(bookId ? { accountBookId: bookId } : {}),
    shopApi.list(bookId ? { accountBookId: bookId } : {}),
  ]);
  const catList: any[] = cats.items || cats || [];
  const shopList: any[] = shps.items || shps || [];
  catMap.value = Object.fromEntries(catList.map((c) => [c.code, c.name]));
  shopMap.value = Object.fromEntries(shopList.map((s) => [s.code, s.name]));
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

/* ========== 月度概览（桌面端为卡片，移动端融入整版白板） ========== */
.month-overview,
.day-list {
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.mo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mo-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mo-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.mo-arrow:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}

.mo-title {
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  cursor: pointer;
  line-height: 1.2;
}

.mo-cfg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.mo-cfg:hover {
  background: var(--surface-hover);
  color: var(--brand-gold);
}

.mo-stats {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mo-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mo-label {
  font-size: 11px;
  color: var(--text-3);
}

.mo-num {
  font-size: 24px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mo-num.expense {
  color: var(--amount-expense);
}

.mo-side {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.mo-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.mo-val {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.mo-val.income {
  color: var(--amount-income);
}

.mo-val.balance {
  color: var(--brand-gold);
}

.mo-vdiv {
  width: 1px;
  height: 30px;
  background: var(--border-glass);
}

/* ========== 最近一天明细 ========== */
.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.day-head-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.day-label {
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.day-sum {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
}

.day-more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 4px 2px;
  font-size: 12px;
  color: var(--brand-gold);
  cursor: pointer;
  white-space: nowrap;
}

.day-body {
  min-height: 60px;
}

.day-row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 11px 0;
  cursor: pointer;
  transition: background 0.15s ease;
}

.day-row:hover {
  background: var(--surface-hover);
}

.day-row:active {
  background: var(--surface-active);
}

/* 行间内嵌分隔线（从左色条右侧起算，对齐原型 inset divider） */
.day-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 18px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--border-glass);
}

/* 4px 分类色左侧条（精致行：用色条代替头像，保留分类色彩识别） */
.row-bar {
  flex-shrink: 0;
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  opacity: 0.85;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

/* 第一行：账目名（粗体）+ 分类小标签（彩色，名字替换空格时无缝衔接） */
.row-line1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.row-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

/* 分类小标签（仅当 description ≠ category name 时出现，颜色随分类变化） */
.row-cat-tag {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.85;
}

.row-sub {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-amount {
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  align-self: center;
}

.row-amount.income {
  color: var(--amount-income);
}

.row-amount.expense {
  color: var(--amount-expense);
}

/* 桌面端区块间分隔线隐藏（用 gap），移动端启用 */
.sheet-divider {
  display: none;
  height: 1px;
  background: var(--border-glass);
}

/* ========== FAB（桌面端；移动端由底部 tab 中央按钮提供） ========== */
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

/* ========== 移动端：整版白板铺满（对齐原型 ContentSheet） ========== */
@media (max-width: 767px) {
  .items-view {
    gap: 0;
    max-width: none;
    min-height: 100%;
    background: var(--surface-active);
    border-radius: 16px 16px 0 0;
    padding: 0 0 calc(76px + env(safe-area-inset-bottom));
    box-sizing: border-box;
  }

  .month-overview,
  .day-list {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
    padding: 16px 16px 14px;
  }

  .sheet-divider {
    display: block;
  }

  /* 统计卡融入白板：去卡片壳，改为区块 + 顶部分隔线 */
  .items-view :deep(.panel) {
    background: transparent;
    border: none;
    border-top: 1px solid var(--border-glass);
    box-shadow: none;
    backdrop-filter: none;
    border-radius: 0;
  }

  .items-view :deep(.panel .panel-head) {
    padding: 14px 16px 8px;
  }

  .items-view :deep(.panel .panel-body) {
    padding: 4px 16px 14px;
  }

  /* 移动端新增入口由底部 tab 中间按钮提供，隐藏右下角 FAB */
  .fab {
    display: none;
  }

  .mo-num {
    font-size: 22px;
  }

  .day-row:not(:last-child)::after {
    left: 18px;
  }
}
</style>
