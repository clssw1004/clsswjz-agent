<template>
  <div class="stats-page">
    <!-- 时间范围选择器（对齐 GUI 时间段切换） -->
    <Panel>
      <div class="range-row">
        <div class="range-tabs">
          <button v-for="t in timeRanges" :key="t.key" class="range-tab" :class="{ on: activeRange === t.key }" @click="selectRange(t.key)">
            {{ t.label }}
          </button>
        </div>
        <span class="range-label">{{ rangeLabel }}</span>
      </div>
    </Panel>

    <!-- 收支概览（对齐 BookStatisticCard） -->
    <Panel :icon="Wallet" title="收支概览" accent>
      <template #head>
        <span class="stat-head-book">{{ currentBookName }}</span>
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
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-pill pill-balance">
            <el-icon :size="14"><Coin /></el-icon>结余
          </span>
          <span class="stat-num num" :class="balance >= 0 ? 'income' : 'expense'">{{ fmt(balance) }}</span>
        </div>
      </div>
      <div class="stat-line"></div>
    </Panel>

    <!-- 分类饼图（对齐 GUI CategoryPieChart） -->
    <Panel title="分类分布">
      <template #action>
        <div class="cat-switch">
          <button class="cat-btn" :class="{ on: typeFilter === 'EXPENSE' }" @click="switchType('EXPENSE')">支出</button>
          <button class="cat-btn" :class="{ on: typeFilter === 'INCOME' }" @click="switchType('INCOME')">收入</button>
        </div>
      </template>
      <div v-loading="loading" class="chart-area">
        <el-empty v-if="!loading && !pieData.length" description="暂无数据" />
        <div v-else class="pie-wrap">
          <v-chart class="pie-chart" :option="pieOption" autoresize />
          <div class="pie-legend">
            <div v-for="(item, i) in pieData.slice(0, 8)" :key="item.name" class="legend-item">
              <span class="legend-dot" :style="{ background: PIE_COLORS[i % PIE_COLORS.length] }"></span>
              <span class="legend-name">{{ item.name }}</span>
              <span class="legend-val">{{ fmt(item.value) }}</span>
              <span class="legend-pct">{{ item.pct }}%</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>

    <!-- 分类列表（保留原有进度条样式） -->
    <Panel title="分类明细">
      <div v-loading="loading" class="cat-list">
        <el-empty v-if="!loading && !filtered.length" description="暂无数据" />
        <div v-for="c in filtered" :key="c.categoryCode" class="cat-item">
          <div class="cat-row1">
            <span class="cat-name">{{ catName(c.categoryCode) || c.categoryCode || '未分类' }}</span>
            <span class="cat-count">{{ c.count }} 笔</span>
            <span class="cat-total num" :class="typeFilter === 'INCOME' ? 'inc' : 'exp'">
              {{ fmt(Math.abs(c.total)) }}
            </span>
          </div>
          <div class="cat-bar">
            <div class="cat-bar-fill" :class="typeFilter === 'INCOME' ? 'inc' : 'exp'"
              :style="{ width: percent(c.total) + '%' }"></div>
          </div>
        </div>
      </div>
    </Panel>

    <!-- 日历热力图（对齐 GUI DailyStatisticCalendar） -->
    <Panel title="每日支出">
      <div v-loading="loading" class="heatmap-area">
        <el-empty v-if="!loading || dailyData.length" description="">
          <template #default v-if="!loading && !dailyData.length">暂无数据</template>
        </el-empty>
        <div v-else></div>
        <div v-if="dailyData.length" class="heatmap-wrap">
          <div class="heatmap-header">
            <span v-for="d in ['一', '二', '三', '四', '五', '六', '日']" :key="d" class="heatmap-dow">{{ d }}</span>
          </div>
          <div class="heatmap-grid">
            <div v-for="(cell, i) in heatmapCells" :key="i" class="hm-cell" :class="{ empty: !cell.date }"
              :style="cell.date ? { background: heatColor(cell.amount) } : undefined"
              :title="cell.date ? `${cell.date}: ¥${cell.amount.toFixed(2)}` : ''">
              <span v-if="cell.date" class="hm-day">{{ cell.day }}</span>
            </div>
          </div>
          <div class="heatmap-legend">
            <span class="hm-leg-label">少</span>
            <div v-for="(c, i) in HEAT_COLORS" :key="i" class="hm-leg-box" :style="{ background: c }"></div>
            <span class="hm-leg-label">多</span>
          </div>
        </div>
      </div>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Calendar, Wallet, ArrowDown, ArrowUp, Coin } from '@element-plus/icons-vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { PieChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { itemApi, categoryApi } from '@/api';
import { useAppStore } from '@/stores/app';
import Panel from '@/components/Panel.vue';

use([PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const app = useAppStore();

// ========== 时间范围 ==========
type RangeKey = 'week' | 'month' | 'year' | 'all';
const activeRange = ref<RangeKey>('month');
const customMonth = ref('');
const customSheet = ref(false);

const now = new Date();
const timeRanges = [
  { key: 'week' as const, label: '本周' },
  { key: 'month' as const, label: '本月' },
  { key: 'year' as const, label: '本年' },
  { key: 'all' as const, label: '全部' },
];

function selectRange(key: RangeKey) {
  activeRange.value = key;
}

const range = computed(() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (activeRange.value) {
    case 'week': {
      const day = d.getDay() || 7; // Mon=1..Sun=7
      const mon = new Date(y, m, d.getDate() - day + 1);
      const sun = new Date(y, m, d.getDate() + (7 - day));
      return {
        startDate: fmtDate(mon),
        endDate: fmtDate(sun) + ' 23:59:59',
      };
    }
    case 'month': {
      const lastDay = new Date(y, m + 1, 0).getDate();
      return {
        startDate: `${y}-${pad(m + 1)}-01`,
        endDate: `${y}-${pad(m + 1)}-${lastDay} 23:59:59`,
      };
    }
    case 'year':
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31 23:59:59` };
    case 'all':
      return { startDate: undefined as any, endDate: undefined as any };
  }
});

const rangeLabel = computed(() => {
  const d = new Date();
  switch (activeRange.value) {
    case 'week': return `${d.getMonth() + 1}月第${getWeekNum(d)}周`;
    case 'month': return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    case 'year': return `${d.getFullYear()}年`;
    case 'all': return '全部时间';
  }
});

// ========== 数据 ==========
const typeFilter = ref<'EXPENSE' | 'INCOME'>('EXPENSE');
const loading = ref(false);
const summary = ref({ income: 0, expense: 0 });
const byCategory = ref<any[]>([]);
const catMap = ref<Record<string, string>>({});
const dailyData = ref<{ date: string; amount: number }[]>([]);

const balance = computed(() => summary.value.income + summary.value.expense);

const currentBookName = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.name || ''
);

const typeTotal = computed(() =>
  byCategory.value
    .filter((c) => c.type === typeFilter.value)
    .reduce((s, c) => s + Math.abs(c.total), 0)
);

const filtered = computed(() =>
  byCategory.value
    .filter((c) => c.type === typeFilter.value)
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
);

// ========== 饼图 ==========
const PIE_COLORS = [
  '#b95b4b', '#43a047', '#e6a23c', '#409eff', '#9c27b0',
  '#00bcd4', '#ff7043', '#66bb6a', '#5c6bc0', '#26a69a',
  '#ef5350', '#ab47bc', '#42a5f5', '#ffa726', '#8d6e63',
];

const pieData = computed(() => {
  const items = filtered.value.map((c) => ({
    name: catName(c.categoryCode) || c.categoryCode || '未分类',
    value: Math.abs(Number(c.total) || 0),
    pct: typeTotal.value ? Math.round((Math.abs(Number(c.total)) / typeTotal.value) * 100) : 0,
  }));
  return items;
});

const pieOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: ¥{c} ({d}%)',
  },
  color: PIE_COLORS,
  series: [{
    type: 'pie',
    radius: ['42%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 6, borderColor: 'var(--surface-glass-strong)', borderWidth: 2 },
    label: { show: false },
    emphasis: {
      label: { show: true, fontSize: 14, fontWeight: 'bold' },
      itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.2)' },
    },
    data: pieData.value,
  }],
}));

// ========== 日历热力图 ==========
const HEAT_COLORS = ['#e8f5e9', '#a5d6a7', '#66bb6a', '#43a047', '#2e7d32'];

const heatmapCells = computed(() => {
  if (!dailyData.value.length) return [];
  const amounts = dailyData.value.map((d) => d.amount);
  const max = Math.max(...amounts, 1);
  const map = new Map(dailyData.value.map((d) => [d.date, d.amount]));

  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const firstDay = new Date(y, m, 1).getDay() || 7; // Mon=1
  const lastDate = new Date(y, m + 1, 0).getDate();

  const cells: { date: string; day: number; amount: number }[] = [];
  // leading empty cells
  for (let i = 1; i < firstDay; i++) cells.push({ date: '', day: 0, amount: 0 });
  for (let day = 1; day <= lastDate; day++) {
    const key = `${y}-${pad(m + 1)}-${pad(day)}`;
    cells.push({ date: key, day, amount: map.get(key) || 0 });
  }
  return cells;
});

function heatColor(amount: number): string {
  if (amount <= 0) return 'transparent';
  const amounts = dailyData.value.map((d) => d.amount).filter((a) => a > 0);
  if (!amounts.length) return 'transparent';
  const max = Math.max(...amounts);
  const ratio = amount / max;
  const idx = Math.min(Math.floor(ratio * HEAT_COLORS.length), HEAT_COLORS.length - 1);
  return HEAT_COLORS[idx];
}

// ========== 工具函数 ==========
const catName = (code?: string) => (code ? catMap.value[code] : '');

function fmt(n: number) {
  return Math.abs(Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(total: number) {
  if (!typeTotal.value) return 0;
  return Math.min(100, (Math.abs(total) / typeTotal.value) * 100);
}

function switchType(t: 'EXPENSE' | 'INCOME') {
  typeFilter.value = t;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getWeekNum(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

// ========== 加载数据 ==========
async function loadMaps() {
  try {
    const res: any = await categoryApi.list(app.currentBookId ? { accountBookId: app.currentBookId } : {});
    const list: any[] = res.items || res || [];
    catMap.value = Object.fromEntries(list.map((c) => [c.code, c.name]));
  } catch { /* optional */ }
}

async function load() {
  loading.value = true;
  try {
    const params: any = {};
    if (app.currentBookId) params.accountBookId = app.currentBookId;
    if (range.value.startDate) params.startDate = range.value.startDate;
    if (range.value.endDate) params.endDate = range.value.endDate;

    const [sumRes, statRes] = await Promise.all([
      itemApi.summary(params),
      itemApi.statistics(params),
    ]);
    summary.value = {
      income: Number(sumRes.income || 0),
      expense: Number(sumRes.expense || 0),
    };
    byCategory.value = statRes.byCategory || [];

    // 加载日数据用于热力图（仅月维度有意义）
    if (activeRange.value === 'month' && range.value.startDate) {
      try {
        const listRes: any = await itemApi.list({
          ...params,
          page: 1,
          pageSize: 500,
        });
        const items: any[] = listRes.items || listRes || [];
        const dayMap = new Map<string, number>();
        for (const it of items) {
          const date = (it.accountDate || '').slice(0, 10);
          if (!date) continue;
          const amt = Number(it.amount) || 0;
          dayMap.set(date, (dayMap.get(date) || 0) + amt);
        }
        dailyData.value = Array.from(dayMap.entries())
          .map(([date, amount]) => ({ date, amount: Math.abs(amount) }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch { dailyData.value = []; }
    } else {
      dailyData.value = [];
    }
  } catch {
    summary.value = { income: 0, expense: 0 };
    byCategory.value = [];
    dailyData.value = [];
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await Promise.all([load(), loadMaps()]);
}

watch(activeRange, reload);
watch(() => app.currentBookId, reload);
onMounted(reload);
</script>

<style scoped>
.stats-page {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

/* 时间范围 */
.range-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.range-tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.range-tab {
  border: none;
  background: transparent;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.range-tab.on {
  background: var(--grad-brand);
  color: var(--on-primary);
  font-weight: 600;
}

.range-label {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

/* 收支概览 */
.stat-head-book { flex: 1; font-size: 12px; color: var(--text-3); }
.stat-body { display: flex; align-items: stretch; gap: 14px; padding: 18px 16px 16px; }
.stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
.stat-pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.pill-expense { color: var(--amount-expense); background: rgba(185, 91, 75, 0.12); }
.pill-income { color: var(--amount-income); background: rgba(67, 160, 71, 0.12); }
.pill-balance { color: var(--text-2); background: rgba(15, 23, 42, 0.08); }
html.dark .pill-balance { background: rgba(255, 255, 255, 0.08); }
.stat-num { font-size: 20px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-num.expense { color: var(--amount-expense); }
.stat-num.income { color: var(--amount-income); }
.stat-divider { width: 1px; height: 44px; align-self: center; background: var(--border-glass); }
.stat-line { height: 2px; border-radius: 1px; margin: 0 16px 14px; background: linear-gradient(90deg, rgba(185, 91, 75, 0.5), rgba(67, 160, 71, 0.5)); }

/* 分类饼图 */
.chart-area { min-height: 60px; }
.pie-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.pie-chart { width: 240px; height: 240px; }
.pie-legend { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { flex: 1; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend-val { font-weight: 600; color: var(--text-1); min-width: 70px; text-align: right; }
.legend-pct { font-size: 12px; color: var(--text-3); min-width: 36px; text-align: right; }

/* 分类列表 */
.cat-switch { display: flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--surface-active); border: 1px solid var(--border-glass); }
.cat-btn { border: none; background: transparent; padding: 4px 14px; border-radius: 999px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all 0.2s ease; }
.cat-btn.on { background: var(--grad-brand); color: var(--on-primary); font-weight: 600; }
.cat-list { display: flex; flex-direction: column; gap: 12px; min-height: 40px; max-height: min(52vh, 460px); overflow-y: auto; overscroll-behavior: contain; }
.cat-item { display: flex; flex-direction: column; gap: 6px; }
.cat-row1 { display: flex; align-items: center; gap: 8px; }
.cat-name { font-size: 13px; font-weight: 500; color: var(--text-1); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-count { font-size: 11px; color: var(--text-3); }
.cat-total { font-size: 14px; font-weight: 700; min-width: 84px; text-align: right; }
.cat-total.inc { color: var(--amount-income); }
.cat-total.exp { color: var(--amount-expense); }
.cat-bar { height: 6px; border-radius: 3px; background: rgba(15, 23, 42, 0.06); overflow: hidden; }
html.dark .cat-bar { background: rgba(255, 255, 255, 0.08); }
.cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.cat-bar-fill.inc { background: linear-gradient(90deg, #43a047, #66bb6a); }
.cat-bar-fill.exp { background: linear-gradient(90deg, #b95b4b, #d48878); }

/* 日历热力图 */
.heatmap-area { min-height: 60px; }
.heatmap-wrap { display: flex; flex-direction: column; gap: 8px; }
.heatmap-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.heatmap-dow { font-size: 11px; color: var(--text-3); font-weight: 500; }
.heatmap-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.hm-cell { aspect-ratio: 1; border-radius: 6px; display: flex; align-items: center; justify-content: center; position: relative; }
.hm-cell.empty { background: transparent; }
.hm-day { font-size: 11px; font-weight: 500; color: var(--text-2); }
.heatmap-legend { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 4px; }
.hm-leg-label { font-size: 11px; color: var(--text-3); }
.hm-leg-box { width: 14px; height: 14px; border-radius: 3px; }
</style>
