<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>项目管理</h2>
        <span class="count">{{ items.length }} 项</span>
      </div>
      <el-button type="primary" round @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新增项目
      </el-button>
    </div>

    <el-card class="glass table-card" shadow="never">
      <el-table v-if="!isMobile" :data="items" v-loading="loading" empty-text="暂无数据" class="mini-table">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="code" label="编码" min-width="160">
          <template #default="{ row }">
            <span class="code-text">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端：卡片列表 -->
      <div v-else class="m-list" v-loading="loading">
        <el-empty v-if="!loading && items.length === 0" description="暂无数据" />
        <div v-for="row in items" :key="row.id" class="m-item">
          <div class="m-main">
            <span class="m-name">{{ row.name }}</span>
            <span class="m-sub mono">{{ row.code }}</span>
          </div>
          <div class="m-ops">
            <button class="m-edit" @click="openDialog(row)">编辑</button>
            <button class="m-del" @click="remove(row)">删除</button>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑项目' : '新增项目'"
      width="440px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" size="large" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码" size="large" />
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
import { onMounted, reactive, ref, watch } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { projectApi } from '@/api';
import { useAppStore } from '@/stores/app';
import { useResponsive } from '@/composables/useResponsive';

const appStore = useAppStore();
const { isMobile } = useResponsive();

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({ id: '', name: '', code: '' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    const res: any = await projectApi.list({ accountBookId: appStore.currentBookId });
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
      await projectApi.update(form.id, data);
    } else {
      await projectApi.create(data);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除项目「${row.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await projectApi.delete(row.id);
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

.table-card.glass {
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.code-text {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-2);
}

.mini-table :deep(th.el-table__cell) {
  background: transparent;
  color: var(--text-3);
  font-weight: 600;
}

.mini-table :deep(.el-table__row) {
  background: transparent;
}

/* 移动端卡片列表 */
.m-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.m-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass);
}

.m-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.m-sub {
  font-size: 11px;
  color: var(--text-3);
}

.m-ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.m-ops button {
  border: none;
  background: transparent;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.m-edit {
  color: var(--brand-gold);
}

.m-del {
  color: var(--brand-red);
}
</style>
