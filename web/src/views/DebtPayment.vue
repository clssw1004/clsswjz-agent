<template>
  <div class="dp">
    <!-- 表单卡 -->
    <div class="f-card">
      <div class="f-field">
        <span class="f-field-label">金额</span>
        <div class="dp-amount-box">
          <span class="dp-sym" :class="colorClass">¥</span>
          <el-input
            v-model="form.amount"
            type="number"
            class="dp-amount"
            :class="colorClass"
            placeholder="0.00"
            size="large"
            @keyup.enter="save"
          />
        </div>
      </div>

      <div class="f-field">
        <span class="f-field-label">关联账户</span>
        <el-select v-model="form.fundId" placeholder="选择账户" clearable size="large" style="width: 100%">
          <el-option v-for="f in funds" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </div>

      <div class="f-field">
        <span class="f-field-label">日期</span>
        <el-date-picker
          v-model="form.date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          size="large"
          style="width: 100%"
        />
      </div>

      <div class="f-field">
        <span class="f-field-label">时间</span>
        <el-time-picker
          v-model="form.time"
          value-format="HH:mm"
          placeholder="选择时间"
          size="large"
          style="width: 100%"
        />
      </div>

      <div class="f-field">
        <span class="f-field-label">备注（选填）</span>
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="例如：张三微信转账 3000" maxlength="200" />
      </div>
    </div>

    <!-- 底部保存 -->
    <div class="dp-savebar">
      <el-button type="primary" round size="large" class="dp-save" :loading="saving" @click="save">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { debtApi, fundApi } from '@/api';

const route = useRoute();
const router = useRouter();
const debtId = route.params.id as string;
const type = (route.query.type as string) || 'COLLECTION';

const saving = ref(false);
const funds = ref<any[]>([]);

const TITLES: Record<string, string> = {
  LEND: '记一笔借出', BORROW: '记一笔借入',
  COLLECTION: '记一笔收款', REPAYMENT: '记一笔还款',
};

const form = reactive({
  amount: '',
  fundId: '',
  date: todayStr(),
  time: '',
  remark: '',
});

/** 借出/还款 = 支出向红；借入/收款 = 收入向绿（对齐 gui getDebtAmountReverseColor） */
const colorClass = computed(() => (type === 'LEND' || type === 'REPAYMENT' ? 'lend' : 'borrow'));

function todayStr() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function load() {
  try {
    const res: any = await debtApi.get(debtId);
    const d = res?.data ?? res ?? {};
    form.fundId = d.fundId || '';
  } catch { /* ignore */ }
}

async function loadFunds() {
  try {
    const res: any = await fundApi.list({});
    funds.value = Array.isArray(res) ? res : res?.items || [];
  } catch { /* ignore */ }
}

async function save() {
  const amount = Number(form.amount);
  if (!form.amount || Number.isNaN(amount) || amount <= 0) {
    ElMessage.warning('请输入有效金额');
    return;
  }
  saving.value = true;
  try {
    const accountDate = form.date || todayStr();
    await debtApi.addPayment(debtId, {
      categoryCode: type,
      amount,
      fundId: form.fundId,
      accountDate,
      description: form.remark,
    });
    ElMessage.success('已记录');
    router.back();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  // 动态标题（对齐设计稿 Nav Bar「记一笔收款/还款/借出/借入」）
  route.meta.title = TITLES[type] || '记一笔';
  load();
  loadFunds();
});
</script>

<style scoped>
.dp {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 24px;
}

.f-card {
  margin: 4px 12px 0;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.f-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.f-field-label {
  font-size: 13px;
  font-weight: 600;
  color: #1a1c26;
}

/* 金额 */
.dp-amount-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 48px;
  border-radius: 12px;
  background: #f5f7fa;
}

.dp-sym {
  font-size: 18px;
  font-weight: 500;
}

.dp-sym.lend,
.dp-amount.lend :deep(.el-input__inner) {
  color: #f2573d;
}

.dp-sym.borrow,
.dp-amount.borrow :deep(.el-input__inner) {
  color: #2ba370;
}

.dp-amount {
  flex: 1;
}

.dp-amount :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none !important;
}

.dp-amount :deep(.el-input__inner) {
  font-size: 22px;
  font-weight: 700;
  text-align: right;
  border: none;
  background: transparent;
  padding: 0;
}

/* 底部保存 */
.dp-savebar {
  position: sticky;
  bottom: 0;
  padding: 12px;
  background: linear-gradient(180deg, rgba(246, 247, 249, 0) 0%, rgba(246, 247, 249, 0.92) 30%, #f6f7f9 100%);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

.dp-save {
  width: 100%;
  height: 46px;
  border-radius: 23px;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  font-size: 15px;
  font-weight: 600;
}

/* 暗色 */
html.dark .f-card {
  background: #1e2130;
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .f-field-label {
  color: #e8eaf0;
}

html.dark .dp-amount-box {
  background: rgba(255, 255, 255, 0.04);
}

html.dark .dp-savebar {
  background: linear-gradient(180deg, rgba(23, 25, 35, 0) 0%, rgba(23, 25, 35, 0.92) 30%, #171923 100%);
}
</style>
