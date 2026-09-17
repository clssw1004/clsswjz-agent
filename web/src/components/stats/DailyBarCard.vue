<template>
  <Panel title="每日收支" :icon="TrendCharts">
    <template #action>
      <div class="seg">
        <button class="seg-btn" :class="{ on: mode === 'expense' }" @click="mode = 'expense'">支出</button>
        <button class="seg-btn" :class="{ on: mode === 'income' }" @click="mode = 'income'">收入</button>
      </div>
    </template>

    <div v-if="days.length" class="chart">
      <!-- 水平网格线 -->
      <div class="grid">
        <i v-for="g in 4" :key="g" :style="{ top: (g * 20) + '%' }"></i>
      </div>
      <div class="bars">
        <div v-for="(d, idx) in days" :key="d.date" class="bar-col">
          <div
            class="bar"
            :class="mode"
            :style="{ height: barHeight(d), maxWidth: colMaxWidth }"
            :title="d.date.slice(5) + ' ' + (mode === 'income' ? '收入' : '支出') + ' ¥' + fmtValue(d)"
          ></div>
          <span v-if="showXLabel(d, idx)" class="x">{{ xLabel(d) }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="72" description="本月暂无账目" />
  </Panel>
</template>

<script setup lang="ts">
/**
 * 每日收支柱状图 —— 对齐 Ardot 原型「02-每日收支柱状图」/ gui DailyStatisticBar。
 * 数据由父级按日聚合后传入（仅含当月有账目的日期，升序）。
 */
import { ref, computed } from 'vue';
import { TrendCharts } from '@element-plus/icons-vue';
import Panel from '@/components/Panel.vue';

const props = defineProps<{
  stats: { date: string; income: number; expense: number }[];
  /** 当月月份（YYYY-MM），用于生成整月 1~N 号的完整槽位（缺失日期补零） */
  month?: string;
}>();

const mode = ref<'expense' | 'income'>('expense'); // 默认支出（对齐 gui _showIncome=false）

/** 推断月份：优先 month prop，否则取首条数据的年月 */
const monthKey = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(props.month || ''));
  if (m) return `${m[1]}-${m[2]}`;
  const first = props.stats[0]?.date;
  return first ? String(first).slice(0, 7) : '';
});

/** 当月天数 */
const daysInMonth = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.value);
  if (!m) return 0;
  return new Date(Number(m[1]), Number(m[2]), 0).getDate();
});

/** 整月槽位：1~N 号每天一列，没账目的日期补零 —— 保证柱子与真实日期对齐、疏密均匀 */
const days = computed(() => {
  const n = daysInMonth.value;
  if (!n) return [];
  const byDate = new Map(props.stats.map((s) => [String(s.date).slice(0, 10), s]));
  const arr: { date: string; income: number; expense: number }[] = [];
  for (let d = 1; d <= n; d++) {
    const date = `${monthKey.value}-${String(d).padStart(2, '0')}`;
    const s = byDate.get(date);
    arr.push({ date, income: Number(s?.income || 0), expense: Math.abs(Number(s?.expense || 0)) });
  }
  return arr;
});

const maxVal = computed(() => {
  let m = 0;
  for (const d of days.value) {
    const v = mode.value === 'income' ? d.income : Math.abs(d.expense);
    if (v > m) m = v;
  }
  return m || 1;
});

function barHeight(d: { income: number; expense: number }) {
  const v = mode.value === 'income' ? d.income : Math.abs(d.expense);
  if (!v) return '2px';
  return Math.max(2, Math.round((v / maxVal.value) * 100)) + '%';
}

function fmtValue(d: { income: number; expense: number }) {
  const v = mode.value === 'income' ? d.income : Math.abs(d.expense);
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

const showXLabel = (_d: { date: string }, idx: number) => idx % xInterval.value === 0;
const xLabel = (d: { date: string }) => String(Number(d.date.slice(8, 10)));

/** X 轴标签间隔：整月 28~31 列，隔 3 列标一个（1、4、7…），保证不拥挤 */
const xInterval = computed(() => {
  const n = days.value.length;
  if (n <= 10) return 1; // 数据点少，全显
  if (n <= 20) return 2;
  return 3;
});

/** 柱子宽度：整月固定槽位数，统一 8px（数据少时收窄避免柱过粗） */
const colMaxWidth = computed(() => {
  const n = days.value.length;
  if (n <= 7) return '6px';
  if (n <= 20) return '8px';
  return '10px';
});
</script>

<style scoped>
/* 切换胶囊（选中：类型色描边 + 浅底 + 加粗；未选中：灰边透明） */
.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.seg-btn {
  border: 1px solid var(--border-glass-strong);
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  padding: 4px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 400;
}

.seg-btn.on {
  font-weight: 600;
}

.seg-btn:nth-child(1).on {
  border-color: var(--amount-expense);
  color: var(--amount-expense);
  background: rgba(185, 91, 75, 0.1);
}

.seg-btn:nth-child(2).on {
  border-color: var(--amount-income);
  color: var(--amount-income);
  background: rgba(67, 160, 71, 0.1);
}

/* 图表区 */
.chart {
  position: relative;
  height: 200px;
  padding: 6px 4px 0;
}

.grid {
  position: absolute;
  inset: 6px 0 26px;
  pointer-events: none;
}

.grid i {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--border-glass-strong);
}

.bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100%;
  padding-bottom: 22px;
}

.bar-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 4px;
}

.bar {
  width: 100%;
  min-height: 0;
  border-radius: 3px 3px 1px 1px;
  transition: height 0.3s ease, background 0.2s ease;
}

.bar.income {
  background: linear-gradient(180deg, rgba(67, 160, 71, 0.75), rgba(67, 160, 71, 0.95));
}

.bar.expense {
  background: linear-gradient(180deg, rgba(185, 91, 75, 0.75), rgba(185, 91, 75, 0.95));
}

.x {
  font-size: 10px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
