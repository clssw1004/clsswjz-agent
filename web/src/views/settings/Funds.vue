<template>
  <div class="f-page">
    <!-- ===== 头部：标题 + 计数 + 新增 ===== -->
    <div class="f-head">
      <div class="f-title-row">
        <h2>资金账户</h2>
        <span class="f-count">{{ items.length }} 个</span>
      </div>
      <el-button type="primary" round class="f-add" @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新增账户
      </el-button>
    </div>

    <!-- ===== 账户列表（对齐 gui FundListPage 横向行卡片） ===== -->
    <div v-loading="loading" class="f-list">
      <el-empty v-if="!loading && items.length === 0" description="暂无账户" :image-size="60" />

      <div v-for="(f, i) in items" :key="f.id" class="f-card">
        <!-- 类型图标块 -->
        <div class="f-ic" :style="{ background: fundGrad(f.fundType, i) }">
          <el-icon :size="22"><component :is="fundIcon(f.fundType)" /></el-icon>
        </div>

        <!-- 名称 + 类型 + 备注 -->
        <div class="f-body">
          <div class="f-name-row">
            <span class="f-name">{{ f.name }}</span>
            <span v-if="f.isDefault" class="f-default">默认</span>
          </div>
          <span class="f-type">{{ fundTypeLabel(f.fundType) }}</span>
          <span v-if="f.fundRemark" class="f-remark">{{ f.fundRemark }}</span>
        </div>

        <!-- 余额 + 操作 -->
        <div class="f-right">
          <span class="f-balance" :class="Number(f.fundBalance) >= 0 ? 'pos' : 'neg'">
            {{ formatBalance(f.fundBalance) }}
          </span>
          <div class="f-ops">
            <button class="f-op" title="编辑账户" @click="openDialog(f)">
              <el-icon :size="15"><EditPen /></el-icon>
            </button>
            <button class="f-op danger" title="删除账户" @click="remove(f)">
              <el-icon :size="15"><Delete /></el-icon>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 新增 / 编辑弹窗 ===== -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑账户' : '新增账户'"
      width="min(420px, 92vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="账户名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：招商银行储蓄卡" size="large" maxlength="50" />
        </el-form-item>
        <el-form-item label="账户类型" prop="fundType">
          <el-select v-model="form.fundType" style="width: 100%" size="large">
            <el-option v-for="t in FUND_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="余额" prop="fundBalance">
          <el-input-number
            v-model="form.fundBalance"
            :precision="2"
            :step="0.01"
            style="width: 100%"
            size="large"
            placeholder="可为负数（欠款账户）"
          />
        </el-form-item>
        <el-form-item label="备注" prop="fundRemark">
          <el-input
            v-model="form.fundRemark"
            type="textarea"
            :rows="3"
            placeholder="可选，账户用途说明"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="设为默认账户" prop="isDefault">
          <el-switch v-model="form.isDefault" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import {
  Plus, EditPen, Delete, Money, CreditCard, Ticket, Wallet,
  ChatDotRound, TrendCharts, Coin, Warning,
} from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { fundApi } from '@/api';
import { useAppStore } from '@/stores/app';

/** 账户类型（对齐主端 FundType 存储值 + gui 10 种枚举） */
const FUND_TYPES = [
  { value: 'CASH', label: '现金' },
  { value: 'DEBIT', label: '储蓄卡' },
  { value: 'CREDIT', label: '信用卡' },
  { value: 'PREPAID', label: '充值卡' },
  { value: 'ALIPAY', label: '支付宝' },
  { value: 'WECHAT', label: '微信' },
  { value: 'DEBT', label: '欠款' },
  { value: 'INVESTMENT', label: '投资' },
  { value: 'E_WALLET', label: '电子钱包' },
  { value: 'OTHER', label: '其他' },
];

const FUND_ICON: Record<string, any> = {
  CASH: Money, DEBIT: CreditCard, CREDIT: CreditCard, PREPAID: Ticket,
  ALIPAY: Wallet, WECHAT: ChatDotRound, DEBT: Warning, INVESTMENT: TrendCharts,
  E_WALLET: Wallet, OTHER: Coin,
};

const FUND_GRAD: Record<string, string> = {
  CASH: 'linear-gradient(135deg, #10b981, #34d399)',
  DEBIT: 'linear-gradient(135deg, #6366f1, #818cf8)',
  CREDIT: 'linear-gradient(135deg, #8b5cf6, #c084fc)',
  PREPAID: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
  ALIPAY: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
  WECHAT: 'linear-gradient(135deg, #10b981, #6ee7b7)',
  DEBT: 'linear-gradient(135deg, #f2573e, #fb7185)',
  INVESTMENT: 'linear-gradient(135deg, #4f46e5, #818cf8)',
  E_WALLET: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
  OTHER: 'linear-gradient(135deg, #8a90a6, #b0b5c0)',
};

const FUND_GRADS = Object.values(FUND_GRAD);

function fundGrad(t?: string, i?: number) {
  return FUND_GRAD[t || ''] || FUND_GRADS[(i ?? 0) % FUND_GRADS.length];
}

function fundIcon(t?: string) {
  return FUND_ICON[t || ''] || Wallet;
}

function fundTypeLabel(t?: string) {
  // 历史数据兼容：旧版本用 BANK 表示储蓄卡
  if (t === 'BANK') return '储蓄卡';
  return FUND_TYPES.find((x) => x.value === t)?.label || t || '-';
}

function formatBalance(v?: number | string) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? '-');
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const app = useAppStore();
const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: '',
  name: '',
  fundType: 'CASH',
  fundBalance: 0,
  fundRemark: '',
  isDefault: false,
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入账户名称', trigger: 'blur' }],
  fundType: [{ required: true, message: '请选择账户类型', trigger: 'change' }],
};

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

function openDialog(row?: any) {
  Object.assign(form, {
    id: row?.id || '',
    name: row?.name || '',
    fundType: row?.fundType || 'CASH',
    fundBalance: row?.fundBalance ?? 0,
    fundRemark: row?.fundRemark || '',
    isDefault: !!row?.isDefault,
  });
  dialogVisible.value = true;
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const data = {
      name: form.name,
      fundType: form.fundType,
      fundBalance: Number(form.fundBalance ?? 0),
      fundRemark: form.fundRemark,
      isDefault: form.isDefault,
      accountBookId: app.currentBookId,
    };
    if (form.id) {
      await fundApi.update(form.id, data);
    } else {
      await fundApi.create(data);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除账户「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await fundApi.delete(row.id);
  ElMessage.success('删除成功');
  load();
}

watch(() => app.currentBookId, load);
onMounted(load);
</script>

<style scoped>
.f-page {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 24px;
}

/* ===== 头部 ===== */
.f-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 12px 0;
  gap: 12px;
}

.f-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.f-title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1d26;
}

.f-count {
  font-size: 12px;
  color: #9ca1ad;
}

.f-add {
  flex-shrink: 0;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  font-weight: 600;
}

/* ===== 列表 ===== */
.f-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

.f-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px;
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  transition: box-shadow 0.15s ease;
}

.f-card:hover {
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.08);
}

/* 类型图标块（48×48 渐变） */
.f-ic {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #ffffff;
}

/* 中间信息 */
.f-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.f-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.f-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1d26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.f-default {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(242, 153, 74, 0.14);
  color: #e8993a;
  font-size: 10px;
  font-weight: 600;
}

.f-type {
  font-size: 12px;
  color: #9ca1ad;
}

.f-remark {
  font-size: 11px;
  color: #b0b5c0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧：余额 + 操作 */
.f-right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.f-balance {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.f-balance.pos {
  color: var(--amount-income, #43a047);
}

.f-balance.neg {
  color: var(--amount-expense, #f2573e);
}

.f-ops {
  display: flex;
  align-items: center;
  gap: 2px;
}

.f-op {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9ca1ad;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.f-op:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1a1d26;
}

.f-op.danger:hover {
  background: rgba(242, 87, 62, 0.1);
  color: #f2573e;
}

/* 暗色适配 */
html.dark .f-card {
  background: #1e2130;
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .f-title-row h2,
html.dark .f-name {
  color: #e8eaf0;
}
</style>
