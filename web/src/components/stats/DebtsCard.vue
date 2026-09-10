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
        v-for="(d, idx) in debts"
        :key="d.id"
        class="debt-item"
        :class="{ 'is-cleared': isCleared(d) }"
        @click="router.push(`/debts/${d.id}`)"
      >
        <!-- 类型图标：借出=红↑ / 借入=绿↓（对齐 Material arrow_circle_up/down_outlined） -->
        <span class="debt-icon" :class="d.debtType === 'LEND' ? 'is-lend' : 'is-borrow'">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              v-if="d.debtType === 'LEND'"
              d="M12 4.5l8 8.5H4z"
              fill="currentColor"
            />
            <path v-else d="M12 19.5L4 11h16z" fill="currentColor" />
          </svg>
        </span>

        <!-- 主体：标签+名（行1）+ 待收/总金额（行2右）+ 进度条（行3） -->
        <div class="debt-main">
          <!-- 行 1：chip + 名称 -->
          <div class="debt-line1">
            <span class="debt-badge" :class="d.debtType === 'LEND' ? 'is-lend' : 'is-borrow'">
              {{ d.debtType === 'LEND' ? '借出' : '借入' }}
            </span>
            <span class="debt-name">{{ d.debtor || '未命名' }}</span>
            <span v-if="d.fundName" class="debt-fund">· {{ d.fundName }}</span>
          </div>

          <!-- 行 2：待收/待还 + 总金额（仅未结清） -->
          <div v-if="!isCleared(d)" class="debt-line2">
            <span class="debt-amount">
              <span class="amount-tag">待收</span>
              <span class="amount-value">¥{{ fmt(d.remainAmount ?? 0) }}</span>
            </span>
            <span class="debt-total">/ ¥{{ fmt(d.amount) }}</span>
          </div>
          <div v-else class="debt-line2">
            <span class="debt-cleared-tag">
              <el-icon :size="12"><CircleCheck /></el-icon>已结清
            </span>
          </div>

          <!-- 行 3：进度条（仅未结清） -->
          <div v-if="!isCleared(d)" class="debt-progress">
            <div
              class="debt-progress-fill"
              :style="{ width: progress(d) + '%' }"
            ></div>
          </div>
        </div>

        <!-- inset 分隔线（缩进到图标右侧，对齐 gui listView.separated） -->
        <div v-if="idx < debts.length - 1" class="debt-divider"></div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * 最近债务 —— 对齐 gui DebtsContainer._DebtItem（取前 3 条）
 * 视觉布局：chip+名（行1）｜待收+总金额（行2右对齐 tabular）｜进度条（行3 缩进 38px）
 * 已结清 = manual cleared 或 remainAmount <= 0（还满自动结清）
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

const isCleared = (d: any) => d.clearState === 'cleared' || Number(d.remainAmount ?? 0) <= 0;

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
  padding: 4px 0 2px;
}

/* 行：垂直三段式 + 缩进分隔线 + 内部 padding 由 line 控制 */
.debt-item {
  position: relative;
  padding: 10px 16px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.debt-item:hover {
  background: var(--surface-hover);
}

.debt-item + .debt-item {
  margin-top: 0;
}

/* inset 分隔线：左缩进到 12+28+8 = 48，对齐图标右侧（对齐 gui listView.separated） */
.debt-divider {
  position: absolute;
  left: 48px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--border-glass);
}

/* 类型图标：28×28 圆形（对齐 gui Container 28×28 BorderRadius 14） */
.debt-icon {
  position: absolute;
  left: 16px;
  top: 11px;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.debt-icon.is-lend {
  background: rgba(185, 91, 75, 0.12);
  color: var(--amount-expense);
}

.debt-icon.is-borrow {
  background: rgba(67, 160, 71, 0.12);
  color: var(--amount-income);
}

/* 主体：左缩进 12+28+8 = 48 */
.debt-main {
  margin-left: 48px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 行 1：标签 chip + 名称 + 资金账户 */
.debt-line1 {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 22px;
}

.debt-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.2px;
}

.debt-badge.is-lend {
  color: var(--amount-expense);
  background: rgba(185, 91, 75, 0.13);
}

.debt-badge.is-borrow {
  color: var(--amount-income);
  background: rgba(67, 160, 71, 0.13);
}

.debt-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex-shrink: 1;
}

.debt-fund {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

/* 行 2：待收/总金额（与进度条分离，可读性更强） */
.debt-line2 {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.debt-amount {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.amount-tag {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.3px;
}

.amount-value {
  font-size: 17px;
  font-weight: 600;
  color: var(--brand-gold); /* 主色蓝（对齐 gui colorScheme.primary + amount 主色） */
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.debt-total {
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/* 已结清绿胶囊（行2 替换「待收/总金额」） */
.debt-cleared-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #2ba370;
  background: rgba(43, 163, 112, 0.1);
  border: 1px solid rgba(43, 163, 112, 0.3);
  padding: 2px 8px;
  border-radius: 20px;
}

/* 行 3：进度条（3px 高 圆角 独立行，左对齐图标右侧 38px） */
.debt-progress {
  margin-top: 4px;
  height: 3px;
  border-radius: 3px;
  background: var(--border-glass-strong);
  overflow: hidden;
}

.debt-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: rgba(46, 107, 229, 0.6); /* 主色蓝（对齐列表页 db-progress-bar / gui primary alpha） */
  transition: width 0.4s ease;
}

/* 已结清态：进度条隐去（与「行2 已结清标签」一致，已在上方 v-if 控掉） */
.debt-item.is-cleared .debt-progress {
  display: none;
}
</style>
