<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>分类管理</h2>
      <el-button type="primary" icon="Plus" @click="openDialog()">新增分类</el-button>
    </div>

    <el-card v-for="group in groups" :key="group.type" class="glass group-card" shadow="never">
      <template #header>
        <div class="group-header">
          <span class="group-title">{{ group.label }}</span>
          <el-tag :type="group.type === 'INCOME' ? 'success' : 'danger'" size="small" effect="light">
            {{ group.list.length }} 项
          </el-tag>
        </div>
      </template>

      <el-table :data="group.list" v-loading="loading" empty-text="暂无数据">
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="code" label="编码" min-width="140" />
        <el-table-column prop="categoryType" label="类型" width="100">
          <template #default="{ row }">{{ typeLabel(row.categoryType) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑分类' : '新增分类'"
      width="440px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="类型" prop="categoryType">
          <el-select v-model="form.categoryType" style="width: 100%">
            <el-option label="支出" value="EXPENSE" />
            <el-option label="收入" value="INCOME" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { categoryApi } from '@/api';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({ id: '', name: '', code: '', categoryType: 'EXPENSE' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  categoryType: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

const groups = computed(() => {
  const expense = items.value.filter((i) => i.categoryType !== 'INCOME');
  const income = items.value.filter((i) => i.categoryType === 'INCOME');
  return [
    { type: 'EXPENSE', label: '支出分类', list: expense },
    { type: 'INCOME', label: '收入分类', list: income },
  ];
});

function typeLabel(t?: string) {
  return t === 'INCOME' ? '收入' : t === 'EXPENSE' ? '支出' : (t || '-');
}

async function load() {
  loading.value = true;
  try {
    const res: any = await categoryApi.list({ accountBookId: appStore.currentBookId });
    items.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  Object.assign(form, {
    id: row?.id || '',
    name: row?.name || '',
    code: row?.code || '',
    categoryType: row?.categoryType || 'EXPENSE',
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
      code: form.code,
      categoryType: form.categoryType,
      accountBookId: appStore.currentBookId,
    };
    if (form.id) {
      await categoryApi.update(form.id, data);
    } else {
      await categoryApi.create(data);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await categoryApi.delete(row.id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
watch(() => appStore.currentBookId, load);
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

.group-card.glass {
  margin-bottom: 16px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-title {
  font-weight: 600;
  color: var(--text-1);
}
</style>
