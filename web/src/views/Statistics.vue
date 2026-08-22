<template>
  <div class="stats-page">
    <!-- 时间范围（月份） -->
    <div class="range-bar glass" @click="monthSheet = true">
      <el-icon :size="15"><Calendar /></el-icon>
      <span class="range-text">{{ monthLabel }}</span>
      <span class="range-change">切换</span>
    </div>

    <!-- 收支概览（对齐 BookStatisticCard） -->
    <div class="stat-card glass">
      <div class="stat-head">
        <el-icon :size="17"><Wallet /></el-icon>
        <span class="stat-head-title">{{ monthLabel }}收支</span>
        <span class="stat-head-book">{{ currentBookName }}</span>
      </div>
      <div class="stat-body">
        <div class="stat-item">
          <span class="stat-pill pill-expense">
            <el-icon :size="14"><ArrowDown /></el-icon>支出
          </span>
          <span class="stat-num num">{{ fmt(summary.expense) }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-pill pill-income">
            <el-icon :size="14"><ArrowUp /></el-icon>收入
          </span>
          <span class="stat-num num">{{ fmt(summary.income) }}</span>
        </div>
      </div>
      <div class="stat-line"></div>
    </div>

    <!-- 分类统计 -->
    <div class="cat-card glass">
      <div class="cat-head">
        <span class="cat-title">分类统计</span>
        <div class="cat-switch">
          <button class="cat-btn" :class="{ on: typeFilter === 'EXPENSE' }" @click="switchType('EXPENSE')">支出</button>
          <button class="cat-btn" :class="{ on: typeFilter === 'INCOME' }" @click="switchType('INCOME')">收入</button>
        </div>
      </div>

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
    </div>

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
import { Calendar, Wallet, ArrowDown, ArrowUp } from '@element-plus/icons-vue';
import { itemApi, categoryApi } from '@/api';
import { useAppStore } from '@/stores/app';

const app = useAppStore();

const now = new Date();
const monthValue = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
);
const monthSheet = ref(false);
const typeFilter = ref<'EXPENSE' | 'INCOME'>('EXPENSE');
const loading = ref(false);

const summary = ref({ income: 0, expense: 0 });
const byCategory = ref<any[]>([]);
const catMap = ref<Record<string, string>>({});

const monthLabel = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  return m ? `${m[1]}年${Number(m[2])}月` : '';
});

const currentBookName = computed(
  () => app.books.find((b: any) => b.id === app.currentBookId)?.name || ''
);

const range = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${match[1]}-${match[2]}-01`,
      endDate: `${match[1]}-${match[2]}-${lastDay} 23:59:59`,
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
    const [sumRes, statRes] = await Promise.all([
      itemApi.summary({
        accountBookId: app.currentBookId,
        startDate: range.value.startDate,
        endDate: range.value.endDate,
      }),
      itemApi.statistics({
        accountBookId: app.currentBookId,
        startDate: range.value.startDate,
        endDate: range.value.endDate,
      }),
    ]);
    summary.value = {
      income: Number(sumRes.income || 0),
      expense: Number(sumRes.expense || 0),
    };
    byCategory.value = statRes.byCategory || [];
  } catch {
    summary.value = { income: 0, expense: 0 };
    byCategory.value = [];
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await Promise.all([load(), loadMaps()]);
}

watch(monthValue, reload);
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

.glass {
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
}

/* 月份切换条 */
.range-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.range-text {
  flex: 1;
  color: var(--text-1);
}

.range-change {
  font-size: 12px;
  font-weight: 400;
  color: var(--brand-gold);
}

/* 收支概览 */
.stat-card {
  overflow: hidden;
}

.stat-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 16px;
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
}

.stat-head-title {
  font-size: 13px;
  font-weight: 600;
}

.stat-head-book {
  flex: 1;
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.stat-line {
  height: 2px;
  border-radius: 1px;
  margin: 0 16px 14px;
  background: linear-gradient(90deg, rgba(185, 91, 75, 0.5), rgba(67, 160, 71, 0.5));
}

/* 分类统计 */
.cat-card {
  overflow: hidden;
  padding: 14px 16px 16px;
}

.cat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cat-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.cat-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
}

.cat-btn {
  border: none;
  background: transparent;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cat-btn.on {
  background: var(--grad-brand);
  color: var(--on-primary);
  font-weight: 600;
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 40px;
}

.cat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 11px;
  color: var(--text-3);
}

.cat-total {
  font-size: 14px;
  font-weight: 700;
  min-width: 84px;
  text-align: right;
}

.cat-total.inc {
  color: var(--amount-income);
}

.cat-total.exp {
  color: var(--amount-expense);
}

.cat-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

html.dark .cat-bar {
  background: rgba(255, 255, 255, 0.08);
}

.cat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.cat-bar-fill.inc {
  background: linear-gradient(90deg, #43a047, #66bb6a);
}

.cat-bar-fill.exp {
  background: linear-gradient(90deg, #b95b4b, #d48878);
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
