<template>
  <Panel title="每日收支" :icon="Calendar">
    <template #action>
      <div class="seg">
        <button class="seg-btn" :class="{ on: showExpense }" @click="showExpense = !showExpense">支出</button>
        <button class="seg-btn" :class="{ on: showIncome }" @click="showIncome = !showIncome">收入</button>
      </div>
    </template>

    <div v-if="hasAny" class="cal">
      <div class="cal-weekdays">
        <span v-for="d in ['一', '二', '三', '四', '五', '六', '日']" :key="d" class="cal-dow">{{ d }}</span>
      </div>
      <div class="cal-grid">
        <div v-for="(cell, i) in cells" :key="i" class="cal-cell" :class="{ empty: !cell.day }">
          <template v-if="cell.day">
            <span class="cal-day">{{ cell.day }}</span>
            <div class="cal-amt">
              <span v-if="showExpense && cell.expense" class="amt amt-expense">-{{ cell.expense }}</span>
              <span v-if="showIncome && cell.income" class="amt amt-income">+{{ cell.income }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="72" description="本月暂无账目" />
  </Panel>
</template>

<script setup lang="ts">
/**
 * 每日收支日历 —— 对齐 Ardot 原型「03-每日收支日历」/ gui DailyStatisticCalendar。
 * 支出/收入可独立开关（gui calendarShowIncome/Expense 双选），cell 内红绿双行小字。
 */
import { ref, computed } from 'vue';
import { Calendar } from '@element-plus/icons-vue';
import Panel from '@/components/Panel.vue';

const props = defineProps<{
  stats: { date: string; income: number; expense: number }[];
  /** 展示月份 YYYY-MM（跟随首页月份切换） */
  month: string;
}>();

const showExpense = ref(true);
const showIncome = ref(true);

const map = computed(() => {
  const m: Record<string, { income: number; expense: number }> = {};
  for (const s of props.stats) {
    m[s.date] = { income: s.income, expense: Math.abs(s.expense) };
  }
  return m;
});

const hasAny = computed(() => props.stats.some((s) => s.income || s.expense));

const cells = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(props.month || '');
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const mon = m ? Number(m[2]) : new Date().getMonth() + 1;
  const firstDow = new Date(y, mon - 1, 1).getDay() || 7; // Mon=1
  const lastDay = new Date(y, mon, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const list: { day: number; income: number; expense: number }[] = [];
  for (let i = 1; i < firstDow; i++) list.push({ day: 0, income: 0, expense: 0 });
  for (let d = 1; d <= lastDay; d++) {
    const key = `${y}-${pad(mon)}-${pad(d)}`;
    const s = map.value[key];
    list.push({ day: d, income: s?.income || 0, expense: s?.expense || 0 });
  }
  return list;
});
</script>

<style scoped>
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

.seg-btn:nth-child(1).on {
  border-color: var(--amount-expense);
  color: var(--amount-expense);
  background: rgba(185, 91, 75, 0.1);
  font-weight: 600;
}

.seg-btn:nth-child(2).on {
  border-color: var(--amount-income);
  color: var(--amount-income);
  background: rgba(67, 160, 71, 0.1);
  font-weight: 600;
}

.cal {
  padding: 2px 0 4px;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 2px;
}

.cal-dow {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 500;
  padding: 4px 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-cell {
  min-height: 52px;
  border-radius: 8px;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 0 3px;
  background: rgba(15, 23, 42, 0.025);
}

html.dark .cal-cell {
  background: rgba(255, 255, 255, 0.04);
}

.cal-cell.empty {
  background: transparent;
}

.cal-day {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  line-height: 1.2;
}

.cal-amt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-height: 24px;
  justify-content: flex-start;
}

.amt {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.amt-expense {
  color: var(--amount-expense);
}

.amt-income {
  color: var(--amount-income);
}
</style>
