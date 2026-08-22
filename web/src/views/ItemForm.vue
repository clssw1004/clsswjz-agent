<template>
  <div class="item-form">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="glass form-card"
    >
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="form.type">
          <el-radio-button value="EXPENSE">支出</el-radio-button>
          <el-radio-button value="INCOME">收入</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="金额" prop="amount">
        <el-input-number
          v-model="form.amount"
          :precision="2"
          :min="0"
          :controls="false"
          class="amount-input"
          placeholder="0.00"
        />
      </el-form-item>

      <el-form-item label="分类" prop="categoryCode">
        <el-select
          v-model="form.categoryCode"
          placeholder="选择分类"
          filterable
          class="full"
        >
          <el-option
            v-for="c in filteredCategories"
            :key="c.code"
            :label="c.name"
            :value="c.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="账户/资金">
        <el-select v-model="form.fundId" placeholder="选择账户" clearable class="full">
          <el-option v-for="f in funds" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="商家">
        <el-select
          v-model="form.shopCode"
          placeholder="选择或输入商家"
          filterable
          allow-create
          default-first-option
          clearable
          class="full"
        >
          <el-option
            v-for="s in shops"
            :key="s.code"
            :label="s.name"
            :value="s.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="标签">
        <el-select
          v-model="form.tagCode"
          placeholder="选择标签"
          filterable
          clearable
          class="full"
        >
          <el-option
            v-for="t in tags"
            :key="t.code"
            :label="t.name"
            :value="t.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="项目">
        <el-select
          v-model="form.projectCode"
          placeholder="选择项目"
          filterable
          clearable
          class="full"
        >
          <el-option
            v-for="p in projects"
            :key="p.code"
            :label="p.name"
            :value="p.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="日期" prop="accountDate">
        <el-date-picker
          v-model="form.accountDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          class="full"
        />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="备注说明（可选）"
        />
      </el-form-item>

      <div class="actions">
        <el-popconfirm
          v-if="isEdit"
          title="确定删除这条记录吗？"
          confirm-button-text="删除"
          cancel-button-text="取消"
          @confirm="onDelete"
        >
          <template #reference>
            <el-button class="delete-btn" plain>删除</el-button>
          </template>
        </el-popconfirm>
        <el-button type="primary" class="save-btn" :loading="saving" @click="onSave">
          保存
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  itemApi,
  categoryApi,
  fundApi,
  shopApi,
  tagApi,
  projectApi,
} from '@/api';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const router = useRouter();
const app = useAppStore();

const itemId = route.params.id ? String(route.params.id) : '';
const isEdit = computed(() => !!itemId);

const formRef = ref<FormInstance>();
const saving = ref(false);

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const form = reactive({
  type: 'EXPENSE' as 'EXPENSE' | 'INCOME',
  amount: undefined as number | undefined,
  categoryCode: '',
  fundId: '',
  shopCode: '',
  tagCode: '',
  projectCode: '',
  accountDate: today(),
  description: '',
});

const rules: FormRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  categoryCode: [{ required: true, message: '请选择分类', trigger: 'change' }],
  accountDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
};

const categories = ref<any[]>([]);
const funds = ref<any[]>([]);
const shops = ref<any[]>([]);
const tags = ref<any[]>([]);
const projects = ref<any[]>([]);

const filteredCategories = computed(() =>
  categories.value.filter((c) => c.categoryType === form.type)
);

async function loadOptions() {
  const bookId = app.currentBookId;
  const [cats, fnds, shps, tgs, prjs] = await Promise.all([
    categoryApi.list(bookId ? { accountBookId: bookId } : {}),
    fundApi.list(),
    shopApi.list(bookId ? { accountBookId: bookId } : {}),
    tagApi.list(bookId ? { accountBookId: bookId } : {}),
    projectApi.list(bookId ? { accountBookId: bookId } : {}),
  ]);
  categories.value = cats.items || cats || [];
  funds.value = fnds.items || fnds || [];
  shops.value = shps.items || shps || [];
  tags.value = tgs.items || tgs || [];
  projects.value = prjs.items || prjs || [];
}

onMounted(async () => {
  try {
    await loadOptions();
  } catch {
    /* options are optional */
  }
  if (itemId) {
    const res: any = await itemApi.get(itemId);
    const it = res.items || res;
    form.type = it.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    form.amount = Math.abs(Number(it.amount));
    form.categoryCode = it.categoryCode || '';
    form.fundId = it.fundId ?? '';
    form.shopCode = it.shopCode || '';
    form.tagCode = it.tagCode || '';
    form.projectCode = it.projectCode || '';
    form.accountDate = it.accountDate;
    form.description = it.description || '';
  }
});

function buildPayload() {
  // 对齐移动端约定：支出存负数、收入存正数（Flutter item_form_provider.dart 的 updateAmount）
  const amount = Number(form.amount) || 0;
  return {
    type: form.type,
    amount: form.type === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount),
    categoryCode: form.categoryCode || null,
    fundId: form.fundId || null,
    shopCode: form.shopCode || null,
    tagCode: form.tagCode || null,
    projectCode: form.projectCode || null,
    accountDate: form.accountDate,
    description: form.description || '',
  };
}

async function onSave() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (isEdit.value) {
      await itemApi.update(itemId, buildPayload());
      ElMessage.success('已保存');
    } else {
      await itemApi.create({ ...buildPayload(), accountBookId: app.currentBookId });
      ElMessage.success('已添加');
    }
    router.back();
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  saving.value = true;
  try {
    await itemApi.delete(itemId);
    ElMessage.success('已删除');
    router.back();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.item-form {
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.form-card.glass {
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  backdrop-filter: blur(12px);
  padding: 20px;
}

.full {
  width: 100%;
}

.amount-input {
  width: 100%;
}

.amount-input :deep(.el-input__inner) {
  font-size: 24px;
  font-weight: 600;
  text-align: left;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.save-btn {
  min-width: 96px;
}

.delete-btn {
  color: var(--brand-red-light);
  border-color: var(--brand-red-light);
}
</style>
