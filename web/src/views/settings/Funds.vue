<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>资金账户</h2>
      <span class="count">{{ items.length }} 个账户</span>
    </div>

    <el-card class="glass table-card" shadow="never">
      <el-table :data="items" v-loading="loading" empty-text="暂无数据">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="fundType" label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="fundTagType(row.fundType)" size="small" effect="light">
              {{ fundTypeLabel(row.fundType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="balance" label="余额" min-width="140" align="right">
          <template #default="{ row }">{{ formatBalance(row.balance) }}</template>
        </el-table-column>
        <el-table-column label="默认账户" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="warning" size="small" effect="light">默认</el-tag>
            <span v-else class="text-3">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fundApi } from '@/api';

const loading = ref(false);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res: any = await fundApi.list();
    items.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

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

function fundTagType(t?: string) {
  switch (t) {
    case 'CASH': return 'success' as const;
    case 'BANK': return '' as const;
    case 'ALIPAY': return 'primary' as const;
    case 'WECHAT': return 'success' as const;
    case 'CREDIT': return 'danger' as const;
    default: return 'info' as const;
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
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  color: var(--text-1);
}

.count {
  font-size: 13px;
  color: var(--text-3);
}

.table-card.glass {
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.text-3 {
  color: var(--text-3);
}
</style>
