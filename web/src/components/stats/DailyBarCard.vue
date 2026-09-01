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
}>();

const mode = ref<'expense' | 'income'>('expense'); // 默认支出（对齐 gui _showIncome=false）

const days = computed(() => [...props.stats].sort((a, b) => a.date.localeCompare(b.date)));

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

/** X 轴标签间隔（对齐 gui _calculateXAxisInterval：按有账目的数据点数量动态） */
const xInterval = computed(() => {
  const n = days.value.length;
  if (n <= 10) return 1; // 数据点少，全显
  if (n <= 20) return 2;
  if (n <= 30) return 3;
  return 5;
});

/** 柱子宽度（对齐 gui _calculateColumnWidth：数据少时收窄避免月初柱过粗） */
const colMaxWidth = computed(() => {
  const n = days.value.length;
  if (n <= 7) return '6px';
  if (n <= 15) return '8px';
  if (n <= 31) return '10px';
  return '6px';
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
