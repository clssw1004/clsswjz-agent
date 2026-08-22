<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>资金账户</h2>
        <span class="count">{{ items.length }} 个账户</span>
      </div>
    </div>

    <div v-loading="loading" class="fund-grid">
      <el-empty v-if="!loading && items.length === 0" description="暂无账户" />

      <div v-for="(f, i) in items" :key="f.id" class="fund-card glass">
        <div class="fund-head">
          <div class="fund-icon" :style="{ '--fund-grad': fundGrad(f.fundType, i) }">
            <el-icon :size="20"><component :is="fundIcon(f.fundType)" /></el-icon>
          </div>
          <el-tag v-if="f.isDefault" type="warning" size="small" effect="light" round>默认</el-tag>
        </div>
        <div class="fund-name">{{ f.name }}</div>
        <div class="fund-type">{{ fundTypeLabel(f.fundType) }}</div>
        <div class="fund-balance num">{{ formatBalance(f.fundBalance) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Wallet, CreditCard, Coin, Goods } from '@element-plus/icons-vue';
import { fundApi } from '@/api';
import { useAppStore } from '@/stores/app';

const FUND_GRADS = [
  'linear-gradient(135deg, #14b8a6, #2dd4bf)',
  'linear-gradient(135deg, #6366f1, #818cf8)',
  'linear-gradient(135deg, #06b6d4, #22d3ee)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
];

function fundGrad(t?: string, i?: number) {
  switch (t) {
    case 'CASH': return 'linear-gradient(135deg, #10b981, #34d399)';
    case 'BANK': return 'linear-gradient(135deg, #6366f1, #818cf8)';
    case 'ALIPAY': return 'linear-gradient(135deg, #06b6d4, #22d3ee)';
    case 'WECHAT': return 'linear-gradient(135deg, #10b981, #6ee7b7)';
    case 'CREDIT': return 'linear-gradient(135deg, #8b5cf6, #c084fc)';
    default: return FUND_GRADS[(i ?? 0) % FUND_GRADS.length];
  }
}

function fundIcon(t?: string) {
  switch (t) {
    case 'CASH': return Coin;
    case 'BANK': return CreditCard;
    case 'ALIPAY': return Wallet;
    case 'WECHAT': return Goods;
    case 'CREDIT': return CreditCard;
    default: return Wallet;
  }
}

const app = useAppStore();
const loading = ref(false);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res: any = await fundApi.list(
      app.currentBookId ? { accountBookId: app.currentBookId } : {}
    );
    items.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

watch(() => app.currentBookId, load);
onMounted(load);

function fundTypeLabel(t?: string) {
  switch (t) {
    case 'CASH': return '现金';
    case 'BANK': return '银行卡';
    case 'ALIPAY': return '支付宝';
    case 'WECHAT': return '微信钱包';
    case 'CREDIT': return '信用卡';
    default: return t || '-';
  }
}

function formatBalance(v?: number | string) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? '-');
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

onMounted(load);
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-header-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--text-1);
}

.count {
  font-size: 13px;
  color: var(--text-3);
}

.fund-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  min-height: 80px;
}

.fund-card.glass {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.fund-card.glass:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-float);
}

.fund-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.fund-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #fff;
  background: var(--fund-grad);
}

.fund-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.fund-type {
  font-size: 12px;
  color: var(--text-3);
}

.fund-balance {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-1);
  margin-top: 4px;
}
</style>
