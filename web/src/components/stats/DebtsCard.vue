<template>
  <Panel title="债务" :icon="Coin" divider>
    <template #action>
      <span class="list-more" @click="router.push('/debts')">
        更多<el-icon :size="14"><ArrowRight /></el-icon>
      </span>
    </template>

    <div v-loading="loading" class="debt-list">
      <el-empty v-if="!loading && !debts.length" :image-size="64" description="暂无债务" />
      <div
        v-for="d in debts"
        :key="d.id"
        class="debt-item"
        @click="router.push(`/debts/${d.id}`)"
      >
        <!-- 类型图标：借出=红底向上箭头 / 借入=绿底向下箭头 -->
        <span class="debt-icon" :class="d.debtType === 'LEND' ? 'is-lend' : 'is-borrow'">
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path
              v-if="d.debtType === 'LEND'"
              d="M8 3 L13 9 H3 Z"
              fill="currentColor"
            />
            <path v-else d="M8 13 L3 7 H13 Z" fill="currentColor" />
          </svg>
        </span>
        <div class="debt-main">
          <div class="debt-row1">
            <span class="debt-name">{{ d.debtor || '未命名' }}</span>
            <span class="debt-badge" :class="d.debtType === 'LEND' ? 'is-lend' : 'is-borrow'">
              {{ d.debtType === 'LEND' ? '借出' : '借入' }}
            </span>
            <span class="debt-amount" :class="{ cleared: isCleared(d) }">
              ¥{{ fmt(d.amount) }}
            </span>
          </div>
          <div class="debt-row2">
            <template v-if="!isCleared(d)">
              <span v-if="d.debtType === 'LEND'" class="debt-remain">
                待收 ¥{{ fmt(d.remainAmount ?? 0) }}
              </span>
              <span v-else class="debt-remain">
                待还 ¥{{ fmt(d.remainAmount ?? 0) }}
              </span>
              <span class="debt-total">/ ¥{{ fmt(d.amount) }}</span>
            </template>
            <span v-else class="debt-cleared">
              <el-icon :size="12"><CircleCheck /></el-icon>已结清
            </span>
            <span class="debt-fund" v-if="d.fundName">· {{ d.fundName }}</span>
          </div>
          <div class="debt-progress">
            <div
              class="debt-progress-fill"
              :class="{ cleared: isCleared(d) }"
              :style="{ width: progress(d) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * 最近债务 —— 对齐 Ardot 原型「06-最近债务」/ gui DebtsContainer（取前 3 条）。
 * 借出 LEND=红↑、借入 BORROW=绿↓；进度条 = 已处理比例（paidAmount/amount），已结清满格变绿。
 */
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Coin, ArrowRight, CircleCheck } from '@element-plus/icons-vue';
import { debtApi } from '@/api';
import { useAppStore } from '@/stores/app';
import Panel from '@/components/Panel.vue';

const router = useRouter();
const app = useAppStore();

const debts = ref<any[]>([]);
const loading = ref(false);

const isCleared = (d: any) => d.clearState === 'cleared';

function progress(d: any) {
  if (isCleared(d)) return 100;
  const total = Number(d.amount) || 0;
  if (!total) return 0;
  return Math.min(100, Math.round(((Number(d.paidAmount) || 0) / total) * 100));
}

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function load() {
  if (!app.currentBookId) return;
  loading.value = true;
  try {
    const res: any = await debtApi.list({ accountBookId: app.currentBookId, page: 1 });
    debts.value = (res.items || []).slice(0, 3);
  } catch {
    debts.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => app.currentBookId, load);
</script>

<style scoped>
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

.debt-list {
  min-height: 60px;
  padding: 2px 0;
}

.debt-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 11px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.debt-item:hover {
  background: var(--surface-hover);
}

.debt-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.debt-icon.is-lend {
  background: var(--amount-expense);
}

.debt-icon.is-borrow {
  background: var(--amount-income);
}

.debt-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.debt-row1 {
  display: flex;
  align-items: center;
  gap: 7px;
}

.debt-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.debt-badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
}

.debt-badge.is-lend {
  color: var(--amount-expense);
  background: rgba(185, 91, 75, 0.12);
}

.debt-badge.is-borrow {
  color: var(--amount-income);
  background: rgba(67, 160, 71, 0.12);
}

.debt-amount {
  margin-left: auto;
  font-size: 17px;
  font-weight: 600;
  color: var(--brand-gold-dark);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

.debt-amount.cleared {
  color: var(--text-3);
  text-decoration: line-through;
}

.debt-row2 {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.debt-remain {
  color: var(--text-2);
}

.debt-total {
  opacity: 0.75;
}

.debt-cleared {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--amount-income);
  font-weight: 500;
}

.debt-fund {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.debt-progress {
  height: 3px;
  border-radius: 3px;
  background: var(--border-glass-strong);
  overflow: hidden;
}

.debt-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--grad-brand);
  transition: width 0.4s ease;
}

.debt-progress-fill.cleared {
  background: var(--amount-income);
}
</style>
