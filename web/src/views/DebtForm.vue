<template>
  <div class="df">
    <!-- 表单卡 -->
    <div class="f-card">
      <!-- 类型 segmented：借出 / 借入（对齐设计稿，选中色随类型：借出红/借入绿） -->
      <div class="df-type-row">
        <button
          type="button"
          class="df-type-btn"
          :class="form.debtType === 'LEND' ? 'on lend' : ''"
          @click="form.debtType = 'LEND'"
        >
          <el-icon :size="15"><Top /></el-icon>
          借出
          <span class="df-type-sub">别人欠我</span>
        </button>
        <button
          type="button"
          class="df-type-btn"
          :class="form.debtType === 'BORROW' ? 'on borrow' : ''"
          @click="form.debtType = 'BORROW'"
        >
          <el-icon :size="15"><Bottom /></el-icon>
          借入
          <span class="df-type-sub">我欠别人</span>
        </button>
      </div>

      <!-- 类型提示（对齐设计稿 Type Hint，色随类型） -->
      <div class="df-hint" :class="form.debtType === 'LEND' ? 'lend' : 'borrow'">
        <el-icon :size="11"><component :is="form.debtType === 'LEND' ? Top : Bottom" /></el-icon>
        {{ form.debtType === 'LEND' ? '创建后可继续记一笔收款，收回欠款' : '创建后可继续记一笔还款，归还欠款' }}
      </div>

      <!-- 金额（色随类型） -->
      <div class="f-field">
        <span class="f-field-label">金额</span>
        <div class="df-amount-box">
          <span class="df-sym" :class="typeClass">¥</span>
          <el-input
            v-model="form.amount"
            type="number"
            class="df-amount"
            :class="typeClass"
            placeholder="0.00"
            size="large"
            @keyup.enter="save"
          />
        </div>
      </div>

      <div class="f-field">
        <span class="f-field-label">对方（债务人/债主）</span>
        <el-input v-model="form.debtor" placeholder="如：张三、招商银行" maxlength="50" size="large" />
      </div>

      <div class="f-field">
        <span class="f-field-label">关联账户</span>
        <el-select v-model="form.fundId" placeholder="选择账户" clearable size="large" style="width: 100%">
          <el-option v-for="f in funds" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </div>

      <div class="f-field">
        <span class="f-field-label">债务日期</span>
        <el-date-picker
          v-model="form.debtDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          size="large"
          style="width: 100%"
        />
      </div>

      <div class="f-field">
        <span class="f-field-label">预计结清日期（选填）</span>
        <el-date-picker
          v-model="form.expectedClearDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          clearable
          size="large"
          style="width: 100%"
        />
      </div>
    </div>

    <!-- 底部保存 -->
    <div class="df-savebar">
      <el-button type="primary" round size="large" class="df-save" :loading="saving" @click="save">
        保存
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Top, Bottom } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { debtApi, fundApi } from '@/api';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const app = useAppStore();

const saving = ref(false);
const funds = ref<any[]>([]);

const form = reactive({
  debtType: 'BORROW',
  amount: '',
  debtor: '',
  fundId: '',
  debtDate: todayStr(),
  expectedClearDate: '',
});

const typeClass = computed(() => (form.debtType === 'LEND' ? 'lend' : 'borrow'));

function todayStr() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function loadFunds() {
  try {
    const res: any = await fundApi.list(app.currentBookId ? { accountBookId: app.currentBookId } : {});
    funds.value = Array.isArray(res) ? res : res?.items || [];
  } catch { /* ignore */ }
}

async function save() {
  if (!form.debtor.trim()) {
    ElMessage.warning('请填写对方名称');
    return;
  }
  const amount = Number(form.amount);
  if (!form.amount || Number.isNaN(amount) || amount <= 0) {
    ElMessage.warning('请输入有效金额');
    return;
  }
  saving.value = true;
  try {
    await debtApi.create({
      debtType: form.debtType,
      debtor: form.debtor.trim(),
      amount,
      fundId: form.fundId,
      debtDate: form.debtDate || todayStr(),
      expectedClearDate: form.expectedClearDate || null,
      accountBookId: app.currentBookId,
    });
    ElMessage.success('创建成功');
    router.back();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadFunds);
</script>

<style scoped>
.df {
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

/* 类型 segmented */
.df-type-row {
  display: flex;
  gap: 8px;
}

.df-type-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 0;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 12px;
  background: #f5f7fa;
  color: #1a1c26;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.df-type-sub {
  font-size: 10px;
  font-weight: 400;
  color: #8a8f99;
}

.df-type-btn.on.lend {
  border-color: #f2573d;
  background: rgba(242, 87, 61, 0.1);
  color: #f2573d;
}

.df-type-btn.on.lend .df-type-sub {
  color: #f2a89e;
}

.df-type-btn.on.borrow {
  border-color: #2ba370;
  background: rgba(43, 163, 112, 0.1);
  color: #2ba370;
}

.df-type-btn.on.borrow .df-type-sub {
  color: #8fd9b8;
}

/* 类型提示 */
.df-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 2px;
  font-size: 11px;
}

.df-hint.lend {
  color: #f2573d;
}

.df-hint.borrow {
  color: #2ba370;
}

/* 字段 */
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
.df-amount-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 48px;
  border-radius: 12px;
  background: #f5f7fa;
}

.df-sym {
  font-size: 18px;
  font-weight: 500;
}

.df-sym.lend,
.df-amount.lend :deep(.el-input__inner) {
  color: #f2573d;
}

.df-sym.borrow,
.df-amount.borrow :deep(.el-input__inner) {
  color: #2ba370;
}

.df-amount {
  flex: 1;
}

.df-amount :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none !important;
}

.df-amount :deep(.el-input__inner) {
  font-size: 22px;
  font-weight: 700;
  text-align: right;
  border: none;
  background: transparent;
  padding: 0;
}

/* 底部保存 */
.df-savebar {
  position: sticky;
  bottom: 0;
  padding: 12px;
  background: linear-gradient(180deg, rgba(246, 247, 249, 0) 0%, rgba(246, 247, 249, 0.92) 30%, #f6f7f9 100%);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

.df-save {
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

html.dark .f-field-label,
html.dark .df-type-btn {
  color: #e8eaf0;
}

html.dark .df-type-btn {
  background: rgba(255, 255, 255, 0.04);
}

html.dark .df-amount-box {
  background: rgba(255, 255, 255, 0.04);
}

html.dark .df-savebar {
  background: linear-gradient(180deg, rgba(23, 25, 35, 0) 0%, rgba(23, 25, 35, 0.92) 30%, #171923 100%);
}
</style>
