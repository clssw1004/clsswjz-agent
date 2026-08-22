<template>
  <div class="items-view">
    <div class="toolbar glass">
      <el-date-picker
        v-model="monthValue"
        type="month"
        format="YYYY-MM"
        value-format="YYYY-MM"
        :clearable="false"
        class="month-picker"
        placeholder="选择月份"
      />
      <el-select
        :model-value="app.currentBookId"
        class="book-select"
        placeholder="选择账本"
        @change="(v: any) => app.switchBook(v)"
      >
        <el-option
          v-for="b in app.books"
          :key="b.id"
          :label="b.name"
          :value="b.id"
        />
      </el-select>
    </div>

    <div class="summary glass">
      <div class="summary-item">
        <span class="label">收入</span>
        <span class="value income">+{{ totalIncome.toFixed(2) }}</span>
      </div>
      <div class="divider"></div>
      <div class="summary-item">
        <span class="label">支出</span>
        <span class="value expense">&minus;{{ totalExpense.toFixed(2) }}</span>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="items"
      class="table glass"
      :row-style="{ cursor: 'pointer' }"
      @row-click="(row: any) => router.push(`/items/${row.id}`)"
    >
      <el-table-column prop="accountDate" label="日期" width="110" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === 'EXPENSE' ? 'danger' : 'success'" size="small">
            {{ row.type === 'EXPENSE' ? '支出' : '收入' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="130">
        <template #default="{ row }">
          <span :class="row.type === 'EXPENSE' ? 'amount-expense' : 'amount-income'">
            {{ row.type === 'EXPENSE' ? '&minus;' : '+' }}{{ Number(row.amount).toFixed(2) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="categoryCode" label="分类" width="130" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
    </el-table>

    <div class="pagination glass">
      <el-pagination
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPageChange"
      />
    </div>

    <button class="fab" aria-label="新增记账" @click="router.push('/items/new')">+</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { itemApi } from '@/api';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const app = useAppStore();

const now = new Date();
const monthValue = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
);

const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);

const range = computed(() => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue.value || ''));
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${match[1]}-${match[2]}-01`,
      endDate: `${match[1]}-${match[2]}-${lastDay}`,
    };
  }
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return {
    startDate: `${d.getFullYear()}-${mm}-01`,
    endDate: `${d.getFullYear()}-${mm}-${lastDay}`,
  };
});

const totalIncome = computed(() =>
  items.value
    .filter((i) => i.type === 'INCOME')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0)
);
const totalExpense = computed(() =>
  items.value
    .filter((i) => i.type === 'EXPENSE')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0)
);

async function load() {
  loading.value = true;
  try {
    const res: any = await itemApi.list({
      accountBookId: app.currentBookId,
      page: page.value,
      pageSize,
      startDate: range.value.startDate,
      endDate: range.value.endDate,
    });
    items.value = res.items || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

watch(monthValue, () => {
  page.value = 1;
  load();
});

watch(
  () => app.currentBookId,
  () => {
    page.value = 1;
    load();
  }
);

onMounted(load);
</script>

<style scoped>
.items-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 88px;
}

.glass {
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  backdrop-filter: blur(12px);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.month-picker {
  flex: 1;
  max-width: 180px;
}

.book-select {
  flex: 1;
  min-width: 140px;
}

.summary {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 20px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item .label {
  font-size: 12px;
  color: var(--text-2);
}

.summary-item .value {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary-item .value.income {
  color: var(--color-success);
}

.summary-item .value.expense {
  color: var(--brand-red-light);
}

.divider {
  width: 1px;
  height: 36px;
  background: var(--border-glass);
}

.table {
  width: 100%;
}

.table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.table :deep(th.el-table__cell) {
  background: transparent;
  color: var(--text-2);
}

.table :deep(.el-table__row) {
  background: transparent;
}

.amount-expense {
  color: var(--brand-red-light);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-income {
  color: var(--color-success);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.fab {
  position: fixed;
  right: 28px;
  bottom: 32px;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: var(--brand-red-light);
  color: #fff;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
  z-index: 10;
}

.fab:hover {
  transform: scale(1.06);
}

.fab:active {
  transform: scale(0.96);
}
</style>
