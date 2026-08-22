<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>商家管理</h2>
      <el-button type="primary" icon="Plus" @click="openDialog()">新增商家</el-button>
    </div>

    <el-card class="glass table-card" shadow="never">
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索名称或编码"
          clearable
          prefix-icon="Search"
          style="width: 260px"
        />
        <span class="count">{{ filtered.length }} 家</span>
      </div>

      <el-table :data="filtered" v-loading="loading" empty-text="暂无数据">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="code" label="编码" min-width="160" />
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
      :title="form.id ? '编辑商家' : '新增商家'"
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
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { shopApi } from '@/api';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({ id: '', name: '', code: '' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
};

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter(
    (i) =>
      String(i.name || '').toLowerCase().includes(k) ||
      String(i.code || '').toLowerCase().includes(k),
  );
});

async function load() {
  loading.value = true;
  try {
    const res: any = await shopApi.list({ accountBookId: appStore.currentBookId });
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
      accountBookId: appStore.currentBookId,
    };
    if (form.id) {
      await shopApi.update(form.id, data);
    } else {
      await shopApi.create(data);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除商家「${row.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await shopApi.delete(row.id);
  ElMessage.success('删除成功');
  load();
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

.table-card.glass {
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.count {
  font-size: 13px;
  color: var(--text-3);
}
</style>
