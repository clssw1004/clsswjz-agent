<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>资金账户</h2>
        <span class="count">{{ items.length }} 个账户</span>
      </div>
      <el-button type="primary" round @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新增账户
      </el-button>
    </div>

    <div v-loading="loading" class="fund-grid">
      <el-empty v-if="!loading && items.length === 0" description="暂无账户" />

      <div v-for="(f, i) in items" :key="f.id" class="fund-card glass">
        <div class="fund-head">
          <div class="fund-icon" :style="{ '--fund-grad': fundGrad(f.fundType, i) }">
            <el-icon :size="20"><component :is="fundIcon(f.fundType)" /></el-icon>
          </div>
          <div class="fund-head-right">
            <el-tag v-if="f.isDefault" type="warning" size="small" effect="light" round>默认</el-tag>
            <el-dropdown trigger="click" @command="(c: string) => handleCommand(c, f)">
              <span class="fund-menu-trigger">
                <el-icon><MoreFilled /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <div class="fund-name">{{ f.name }}</div>
        <div class="fund-type">{{ fundTypeLabel(f.fundType) }}</div>
        <div class="fund-balance num">{{ formatBalance(f.fundBalance) }}</div>
        <div v-if="f.fundRemark" class="fund-remark">{{ f.fundRemark }}</div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑账户' : '新增账户'"
      width="460px"
      destroy-on-close
      class="form-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="账户名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：招商银行储蓄卡" size="large" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="账户类型" prop="fundType">
          <el-select v-model="form.fundType" style="width: 100%" size="large">
            <el-option label="现金" value="CASH" />
            <el-option label="银行卡" value="BANK" />
            <el-option label="支付宝" value="ALIPAY" />
            <el-option label="微信钱包" value="WECHAT" />
            <el-option label="信用卡" value="CREDIT" />
          </el-select>
        </el-form-item>
        <el-form-item label="余额" prop="fundBalance">
          <el-input-number
            v-model="form.fundBalance"
            :precision="2"
            :step="0.01"
            :min="0"
            style="width: 100%"
            size="large"
            placeholder="请输入初始余额"
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
import { Plus, MoreFilled, Wallet, CreditCard, Coin, Goods } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
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
  fundBalance: [{ required: true, message: '请输入余额', trigger: 'blur' }],
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

function handleCommand(cmd: string, row: any) {
  if (cmd === 'edit') openDialog(row);
  else if (cmd === 'delete') remove(row);
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
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
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

.page-header :deep(.el-button--primary) {
  background: var(--grad-brand);
  border: none;
  box-shadow: var(--glow-primary);
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
  position: relative;
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

.fund-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fund-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-3);
  transition: background 0.15s ease, color 0.15s ease;
}

.fund-menu-trigger:hover {
  background: var(--surface-glass-strong);
  color: var(--text-1);
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

.fund-remark {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 767px) {
  .page-header {
    align-items: flex-start;
  }

  .page-header :deep(.el-button) {
    padding: 8px 14px;
    font-size: 13px;
  }
}
</style>