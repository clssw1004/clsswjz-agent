<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>分类管理</h2>
        <span class="count">{{ items.length }} 项</span>
      </div>
      <el-button type="primary" round @click="openDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新增分类
      </el-button>
    </div>

    <el-card v-for="group in groups" :key="group.type" class="glass group-card" shadow="never">
      <template #header>
        <div class="group-header">
          <span class="group-title">
            <span class="group-dot" :class="group.type === 'INCOME' ? 'dot-income' : 'dot-expense'"></span>
            {{ group.label }}
          </span>
          <el-tag :type="group.type === 'INCOME' ? 'success' : 'danger'" size="small" effect="light" round>
            {{ group.list.length }} 项
          </el-tag>
        </div>
      </template>

      <el-table v-if="!isMobile" :data="group.tree" v-loading="loading" empty-text="暂无数据" class="mini-table" row-key="id" default-expand-all>
        <el-table-column prop="name" label="名称" min-width="160">
          <template #default="{ row }">
            <span :style="{ paddingLeft: (row._depth * 20) + 'px' }">
              <span v-if="row._depth > 0" class="tree-line">└</span>
              {{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="编码" min-width="140" />
        <el-table-column prop="categoryType" label="类型" width="100">
          <template #default="{ row }">
            <span class="type-chip" :class="row.categoryType === 'INCOME' ? 'chip-income' : 'chip-expense'">
              {{ typeLabel(row.categoryType) }}
            </span>
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
        <el-empty v-if="!loading && group.list.length === 0" description="暂无数据" />
        <div v-for="row in group.tree" :key="row.id" class="m-item" :style="{ paddingLeft: (12 + row._depth * 18) + 'px' }">
          <div class="m-main">
            <span class="m-name">
              <span v-if="row._depth > 0" class="tree-line">└</span>
              {{ row.name }}
            </span>
            <span class="m-sub mono">{{ row.code }}</span>
          </div>
          <span class="type-chip" :class="row.categoryType === 'INCOME' ? 'chip-income' : 'chip-expense'">
            {{ typeLabel(row.categoryType) }}
          </span>
          <div class="m-ops">
            <button class="m-edit" @click="openDialog(row)">编辑</button>
            <button class="m-del" @click="remove(row)">删除</button>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑分类' : '新增分类'"
      width="440px"
      destroy-on-close
      class="form-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" size="large" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码" size="large" />
        </el-form-item>
        <el-form-item label="类型" prop="categoryType">
          <el-select v-model="form.categoryType" style="width: 100%" size="large">
            <el-option label="支出" value="EXPENSE" />
            <el-option label="收入" value="INCOME" />
          </el-select>
        </el-form-item>
        <el-form-item label="记账可选">
          <div class="switch-row">
            <el-switch v-model="form.isBookkeepingSelectable" />
            <span class="switch-label">{{ form.isBookkeepingSelectable ? '记账时可选' : '隐藏' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="上级分类">
          <el-select v-model="form.parentId" placeholder="无（顶级分类）" clearable style="width: 100%" size="large">
            <el-option
              v-for="p in parentCandidates"
              :key="p.id"
              :label="('　'.repeat(p._depth)) + p.name"
              :value="p.id"
            />
          </el-select>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { categoryApi } from '@/api';
import { useAppStore } from '@/stores/app';
import { useResponsive } from '@/composables/useResponsive';

const appStore = useAppStore();
const { isMobile } = useResponsive();

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({ id: '', name: '', code: '', categoryType: 'EXPENSE', parentId: '', isBookkeepingSelectable: true });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  categoryType: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

function typeLabel(t?: string) {
  return t === 'INCOME' ? '收入' : t === 'EXPENSE' ? '支出' : (t || '-');
}

/** 构建树：为每个节点标记 _depth，按 sortOrder 排序后递归展开 */
function buildTree(list: any[], parentId = ''): any[] {
  return list
    .filter((i) => (i.parentId || '') === parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .flatMap((node) => {
      const children = list.filter((i) => i.parentId === node.id);
      const depth = parentId === '' ? 0 : (list.find((i) => i.id === parentId)?._depth ?? 0) + 1;
      const item = { ...node, _depth: depth };
      if (children.length) {
        return [item, ...buildTree(list, node.id).map((c) => ({ ...c, _depth: depth + 1 }))];
      }
      return [item];
    });
}

const groups = computed(() => {
  const expense = items.value.filter((i) => i.categoryType !== 'INCOME');
  const income = items.value.filter((i) => i.categoryType === 'INCOME');
  return [
    { type: 'EXPENSE', label: '支出分类', list: expense, tree: buildTree(expense) },
    { type: 'INCOME', label: '收入分类', list: income, tree: buildTree(income) },
  ];
});

/** 上级分类候选（排除自身及子分类，按类型过滤） */
const parentCandidates = computed(() => {
  const currentType = form.categoryType;
  const candidates = items.value.filter(
    (i) => i.categoryType === currentType && i.id !== form.id,
  );
  return buildTree(candidates);
});

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
    parentId: row?.parentId || '',
    isBookkeepingSelectable: row?.isBookkeepingSelectable !== false,
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
      parentId: form.parentId || null,
      isBookkeepingSelectable: form.isBookkeepingSelectable,
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
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-1);
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-expense {
  background: var(--brand-red);
}

.dot-income {
  background: var(--color-success);
}

.type-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.tree-line {
  color: var(--text-3);
  margin-right: 4px;
  font-family: monospace;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switch-label {
  font-size: 13px;
  color: var(--text-2);
}

.chip-expense {
  color: var(--brand-red);
  background: rgba(239, 68, 68, 0.1);
}

.chip-income {
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.12);
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
  padding: 12px 12px;
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
