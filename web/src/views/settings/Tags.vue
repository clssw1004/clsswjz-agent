<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>标签管理</h2>
        <span class="count">{{ items.length }} 个</span>
      </div>
      <el-button type="primary" round @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新增标签
      </el-button>
    </div>

    <el-card class="glass table-card" shadow="never">
      <div v-loading="loading" class="tag-cloud">
        <el-empty v-if="!loading && items.length === 0" description="暂无标签" />
        <span
          v-for="(tag, i) in items"
          :key="tag.id"
          class="tag-chip"
          :style="{ '--tag-grad': chipGrad(i), '--tag-ink': chipInk(i) }"
          @click="openDialog(tag)"
        >
          {{ tag.name }}
          <el-icon class="tag-close" @click.stop="remove(tag)"><Close /></el-icon>
        </span>
      </div>
      <p class="hint">点击标签可编辑，点击 × 可删除</p>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑标签' : '新增标签'"
      width="400px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" maxlength="20" size="large" />
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
import { Close, Plus } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { tagApi } from '@/api';
import { useAppStore } from '@/stores/app';

const CHIP_GRADS = [
  'linear-gradient(135deg, #14b8a6, #2dd4bf)',
  'linear-gradient(135deg, #6366f1, #818cf8)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
  'linear-gradient(135deg, #06b6d4, #22d3ee)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
];

function chipGrad(i: number) {
  return CHIP_GRADS[i % CHIP_GRADS.length];
}

/** 浅色渐变的文字用深色，深色渐变用白色 */
function chipInk(i: number) {
  return i % CHIP_GRADS.length === 2 ? '#1c1204' : '#ffffff';
}

const appStore = useAppStore();

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({ id: '', name: '', code: '' });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    const res: any = await tagApi.list({ accountBookId: appStore.currentBookId });
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
      await tagApi.update(form.id, data);
    } else {
      await tagApi.create(data);
    }
    ElMessage.success(form.id ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除标签「${row.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await tagApi.delete(row.id);
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

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 52px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--tag-grad);
  color: var(--tag-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tag-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
}

.tag-close {
  margin-left: 2px;
  border-radius: 50%;
  font-size: 12px;
  opacity: 0.7;
}

.tag-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.18);
}

.hint {
  margin: 18px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>
