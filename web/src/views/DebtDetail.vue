<template>
  <div class="dd" v-if="debt">
    <!-- ===== 信息卡（对齐设计稿 Info Card） ===== -->
    <div class="dd-info">
      <!-- 类型胶囊 + 债务人 -->
      <div class="dd-row1">
        <span class="dd-type" :class="isLend ? 'lend' : 'borrow'">
          <el-icon :size="14"><component :is="isLend ? Top : Bottom" /></el-icon>
          {{ isLend ? '借出' : '借入' }}
        </span>
        <span class="dd-debtor">{{ debt.debtor }}</span>
      </div>

      <!-- 进度条 + 金额/百分比 -->
      <div class="dd-prog">
        <div class="dd-prog-bar">
          <div class="dd-prog-fill" :style="{ width: progress() }"></div>
        </div>
        <div class="dd-prog-meta">
          <span class="dd-prog-amt">金额: {{ fmtAmount(debt.amount) }}</span>
          <span class="dd-prog-pct">{{ pct() }}</span>
        </div>
      </div>

      <!-- 剩余金额 / 已结清 -->
      <div class="dd-remain" :class="isCleared ? 'cleared' : ''">
        <div v-if="isCleared" class="dd-cleared-row">
          <el-icon :size="22"><CircleCheck /></el-icon>
          <span>已结清</span>
        </div>
        <template v-else>
          <span class="dd-remain-label">{{ isLend ? '待收' : '待还' }}</span>
          <div class="dd-remain-row">
            <span class="dd-sym">¥</span>
            <span class="dd-remain-num">{{ fmtAmount(debt.remainAmount) }}</span>
          </div>
        </template>
      </div>

      <!-- 信息标签 -->
      <div class="dd-tags">
        <span class="dd-tag"><el-icon :size="11"><Calendar /></el-icon>{{ debt.debtDate || '—' }}</span>
        <span class="dd-tag"><el-icon :size="11"><Wallet /></el-icon>{{ debt.fundName || '未选账户' }}</span>
      </div>
    </div>

    <!-- ===== 记录卡 1：借出/借入 ===== -->
    <div class="dd-rec">
      <div class="dd-rec-head">
        <span class="dd-rec-ic" :class="isLend ? 'lend' : 'borrow'">
          <el-icon :size="16"><component :is="isLend ? Top : Bottom" /></el-icon>
        </span>
        <span class="dd-rec-title">{{ isLend ? '借出' : '借入' }}</span>
        <span class="dd-rec-amt" :class="isLend ? 'lend' : 'borrow'">{{ fmtAmount(debtItemsTotal) }}</span>
        <button class="dd-rec-add" @click="goPayment(isLend ? 'LEND' : 'BORROW')">
          <el-icon :size="13"><Plus /></el-icon>{{ isLend ? '借出' : '借入' }}
        </button>
      </div>
      <div class="dd-rec-divider"></div>
      <template v-if="debtItems.length">
        <div v-for="r in debtItems" :key="r.id" class="dd-rec-item" @click="goItem(r.id)">
          <div class="dd-rec-col">
            <span class="dd-rec-date">{{ r.accountDate }}</span>
            <span v-if="r.fundName" class="dd-rec-fund">{{ r.fundName }}</span>
          </div>
          <span class="dd-rec-val" :class="isLend ? 'lend' : 'borrow'">{{ fmtSigned(r.amount) }}</span>
        </div>
      </template>
      <div v-else class="dd-rec-empty">
        <el-icon :size="15"><Box /></el-icon>
        <span>暂无数据</span>
      </div>
    </div>

    <!-- ===== 记录卡 2：收款/还款 ===== -->
    <div class="dd-rec">
      <div class="dd-rec-head">
        <span class="dd-rec-ic" :class="isLend ? 'borrow' : 'lend'">
          <el-icon :size="16"><component :is="isLend ? Bottom : Top" /></el-icon>
        </span>
        <span class="dd-rec-title">{{ isLend ? '收款' : '还款' }}</span>
        <span class="dd-rec-amt" :class="isLend ? 'borrow' : 'lend'">{{ fmtAmount(opItemsTotal) }}</span>
        <button class="dd-rec-add" @click="goPayment(isLend ? 'COLLECTION' : 'REPAYMENT')">
          <el-icon :size="13"><Plus /></el-icon>{{ isLend ? '收款' : '还款' }}
        </button>
      </div>
      <div class="dd-rec-divider"></div>
      <template v-if="opItems.length">
        <div v-for="r in opItems" :key="r.id" class="dd-rec-item" @click="goItem(r.id)">
          <div class="dd-rec-col">
            <span class="dd-rec-date">{{ r.accountDate }}</span>
            <span v-if="r.fundName" class="dd-rec-fund">{{ r.fundName }}</span>
          </div>
          <span class="dd-rec-val" :class="isLend ? 'borrow' : 'lend'">{{ fmtSigned(r.amount) }}</span>
        </div>
      </template>
      <div v-else class="dd-rec-empty">
        <el-icon :size="15"><Box /></el-icon>
        <span>暂无数据</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Top, Bottom, Calendar, Wallet, CircleCheck, Plus, Box } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { debtApi } from '@/api';

const route = useRoute();
const router = useRouter();
const debtId = route.params.id as string;
const debt = ref<any>(null);

const isLend = computed(() => debt.value?.debtType === 'LEND');
const isCleared = computed(() => debt.value && (debt.value.clearState === 'cleared' || Number(debt.value.remainAmount) <= 0));

/** 借出/借入记录 = categoryCode 等于债务类型（LEND/BORROW） */
const debtItems = computed(() => (debt.value?.records || []).filter((r: any) => r.categoryCode === debt.value.debtType));
/** 收款/还款记录 = COLLECTION/REPAYMENT */
const opItems = computed(() => (debt.value?.records || []).filter((r: any) => ['COLLECTION', 'REPAYMENT'].includes(r.categoryCode)));

const debtItemsTotal = computed(() => debtItems.value.reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0));
const opItemsTotal = computed(() => opItems.value.reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0));

function progress() {
  const amount = Number(debt.value?.amount) || 0;
  if (amount <= 0) return '0%';
  const paid = amount - Number(debt.value?.remainAmount ?? amount);
  return `${Math.min(100, Math.max(0, (paid / amount) * 100)).toFixed(1)}%`;
}

function pct() {
  const amount = Number(debt.value?.amount) || 0;
  if (amount <= 0) return '0%';
  const paid = amount - Number(debt.value?.remainAmount ?? amount);
  return `${Math.min(100, Math.max(0, Math.round((paid / amount) * 100)))}%`;
}

function fmtAmount(v?: number | string) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? '-');
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 记录金额带符号显示（借出/还款为负，借入/收款为正） */
function fmtSigned(v?: number | string) {
  const n = Number(v ?? 0);
  return fmtAmount(Math.abs(n));
}

function goPayment(categoryCode: string) {
  router.push(`/debts/${debtId}/payment?type=${categoryCode}`);
}

function goItem(itemId: string) {
  router.push(`/items/${itemId}`);
}

async function load() {
  try {
    const res: any = await debtApi.get(debtId);
    debt.value = res?.data ?? res ?? null;
  } catch (e: any) {
    ElMessage.error(e?.message || '加载债务失败');
  }
}

onMounted(load);
</script>

<style scoped>
.dd {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 12px 24px;
}

/* ===== 信息卡 ===== */
.dd-info {
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dd-row1 {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dd-type {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.dd-type.lend {
  color: #f2573d;
  background: rgba(242, 87, 61, 0.12);
}

.dd-type.borrow {
  color: #2ba370;
  background: rgba(43, 163, 112, 0.12);
}

.dd-debtor {
  font-size: 16px;
  font-weight: 600;
  color: #1a1c26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 进度 */
.dd-prog {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dd-prog-bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.dd-prog-fill {
  height: 100%;
  border-radius: 2px;
  background: rgba(46, 107, 229, 0.7);
  transition: width 0.3s ease;
}

.dd-prog-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dd-prog-amt {
  font-size: 11px;
  color: #8a8f99;
}

.dd-prog-pct {
  font-size: 11px;
  font-weight: 600;
  color: #2e6be5;
}

/* 剩余区块 */
.dd-remain {
  padding: 14px;
  border-radius: 12px;
  background: rgba(46, 107, 229, 0.08);
  border: 1px solid rgba(46, 107, 229, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dd-remain.cleared {
  background: rgba(43, 163, 112, 0.1);
  border-color: rgba(43, 163, 112, 0.3);
}

.dd-remain-label {
  font-size: 10px;
  font-weight: 500;
  color: #8a8f99;
}

.dd-remain-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.dd-sym {
  font-size: 18px;
  font-weight: 500;
  color: #2e6be5;
}

.dd-remain-num {
  font-size: 28px;
  font-weight: 700;
  color: #2e6be5;
  letter-spacing: -0.5px;
}

.dd-cleared-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2ba370;
  font-size: 20px;
  font-weight: 700;
}

/* 信息标签 */
.dd-tags {
  display: flex;
  gap: 8px;
}

.dd-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.04);
  font-size: 12px;
  color: #8a8f99;
}

/* ===== 记录卡 ===== */
.dd-rec {
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  overflow: hidden;
}

.dd-rec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px 10px 14px;
}

.dd-rec-ic {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.dd-rec-ic.lend {
  background: rgba(242, 87, 61, 0.15);
  color: #f2573d;
}

.dd-rec-ic.borrow {
  background: rgba(43, 163, 112, 0.15);
  color: #2ba370;
}

.dd-rec-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1c26;
}

.dd-rec-amt {
  font-size: 18px;
  font-weight: 700;
  margin-left: auto;
  white-space: nowrap;
}

.dd-rec-amt.lend {
  color: #f2573d;
}

.dd-rec-amt.borrow {
  color: #2ba370;
}

.dd-rec-add {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border: none;
  border-radius: 20px;
  background: rgba(46, 107, 229, 0.1);
  color: #2e6be5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.dd-rec-add:hover {
  background: rgba(46, 107, 229, 0.18);
}

.dd-rec-divider {
  height: 0.5px;
  background: rgba(230, 233, 240, 0.8);
}

.dd-rec-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.dd-rec-item:hover {
  background: rgba(15, 23, 42, 0.02);
}

.dd-rec-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dd-rec-date {
  font-size: 12px;
  font-weight: 500;
  color: #8a8f99;
}

.dd-rec-fund {
  font-size: 11px;
  color: #b0b5c0;
}

.dd-rec-val {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}

.dd-rec-val.lend {
  color: #f2573d;
}

.dd-rec-val.borrow {
  color: #2ba370;
}

.dd-rec-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  color: #b0b5c0;
  font-size: 13px;
}

/* 暗色 */
html.dark .dd-info,
html.dark .dd-rec {
  background: #1e2130;
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .dd-debtor,
html.dark .dd-rec-title {
  color: #e8eaf0;
}

html.dark .dd-prog-bar {
  background: rgba(255, 255, 255, 0.1);
}

html.dark .dd-tag {
  background: rgba(255, 255, 255, 0.06);
}

html.dark .dd-rec-divider {
  background: rgba(255, 255, 255, 0.08);
}
</style>
