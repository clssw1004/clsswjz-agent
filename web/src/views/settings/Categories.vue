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

    <!-- 支出/收入 切换 -->
    <div class="seg-wrap">
      <div class="seg-control">
        <button
          v-for="g in segGroups"
          :key="g.type"
          class="seg-item"
          :class="{ active: activeType === g.type }"
          @click="activeType = g.type"
        >
          {{ g.label }}
        </button>
      </div>
    </div>

    <!-- 树形列表卡片 -->
    <el-card class="glass tree-card" shadow="never">
      <div v-loading="loading" class="tree-list">
        <el-empty v-if="!loading && visibleTree.length === 0" description="暂无数据" />

        <template v-for="row in visibleTree" :key="row.id">
          <div
            class="t-row"
            :class="{ 't-row-parent': row._children.length > 0 }"
            :style="{ paddingLeft: 12 + row._depth * 28 + 'px' }"
          >
            <button
              v-if="row._children.length > 0"
              class="t-chevron"
              :class="{ expanded: isExpanded(row.id) }"
              @click="toggle(row.id)"
            >
              <el-icon :size="14">
                <ArrowDown v-if="isExpanded(row.id)" />
                <ArrowRight v-else />
              </el-icon>
            </button>
            <span v-else class="t-chevron t-chevron-empty"></span>

            <span
              class="t-icon"
              :class="row._children.length > 0 ? 'icon-folder' : 'icon-leaf'"
            >
              <el-icon :size="16">
                <FolderOpened v-if="row._children.length > 0 && isExpanded(row.id)" />
                <Folder v-else-if="row._children.length > 0" />
                <Document v-else />
              </el-icon>
            </span>

            <span class="t-name">{{ row.name }}</span>
            <span v-if="row._children.length > 0" class="t-badge">{{ row._children.length }}</span>

            <span class="t-ops">
              <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="remove(row)">删除</el-button>
            </span>
          </div>

          <!-- 展开时：虚线添加子分类 -->
          <div
            v-if="row._children.length > 0 && isExpanded(row.id)"
            class="t-add"
            :style="{ marginLeft: 12 + (row._depth + 1) * 28 + 'px' }"
          >
            <button class="t-add-btn" @click="openDialog(undefined, row)">
              <el-icon :size="13" style="margin-right: 4px"><CirclePlus /></el-icon>
              添加子分类
            </button>
          </div>
        </template>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑分类' : '新增分类'"
      width="min(440px, 90vw)"
      destroy-on-close
      class="form-dialog"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" size="large" />
        </el-form-item>
        <el-form-item label="类型" prop="categoryType">
          <el-select v-model="form.categoryType" style="width: 100%" size="large" :disabled="!!form.id">
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
import { Plus, CirclePlus, ArrowDown, ArrowRight, Folder, FolderOpened, Document } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { categoryApi } from '@/api';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const loading = ref(false);
const saving = ref(false);
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const activeType = ref<'EXPENSE' | 'INCOME'>('EXPENSE');
/** 折叠的父级 id 集合 */
const collapsedIds = ref<Set<string>>(new Set());

const form = reactive({ id: '', name: '', categoryType: 'EXPENSE', parentId: '', isBookkeepingSelectable: true });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  categoryType: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

const segGroups = [
  { type: 'EXPENSE', label: '支出' },
  { type: 'INCOME', label: '收入' },
];

function typeLabel(t?: string) {
  return t === 'INCOME' ? '收入' : t === 'EXPENSE' ? '支出' : (t || '-');
}

/** 构建树：标记 _depth 与 _children（直接子级），按 sortOrder 排序 */
function buildTree(list: any[], parentId = '', depth = 0): any[] {
  return list
    .filter((i) => (i.parentId || '') === parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((node) => ({
      ...node,
      _depth: depth,
      _children: buildTree(list, node.id, depth + 1),
    }));
}

/** 当前类型下的树 */
const currentTree = computed(() => {
  const list = items.value.filter((i) => (i.categoryType || 'EXPENSE') === activeType.value);
  return buildTree(list);
});

/** 按展开状态拍平（DFS），折叠的父级不展开其子级 */
const visibleTree = computed(() => {
  const result: any[] = [];
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      result.push(n);
      if (n._children.length > 0 && !collapsedIds.value.has(n.id)) {
        walk(n._children);
      }
    }
  };
  walk(currentTree.value);
  return result;
});

function isExpanded(id: string) {
  return !collapsedIds.value.has(id);
}

function toggle(id: string) {
  const s = new Set(collapsedIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  collapsedIds.value = s;
}

/** 上级分类候选（排除自身及子分类，按当前类型过滤） */
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

function openDialog(row?: any, parent?: any) {
  Object.assign(form, {
    id: row?.id || '',
    name: row?.name || '',
    categoryType: row?.categoryType || (parent ? parent.categoryType : activeType.value) || 'EXPENSE',
    parentId: row?.parentId || parent?.id || '',
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

/* 支出/收入 segmented */
.seg-wrap {
  margin-bottom: 16px;
}

.seg-control {
  display: flex;
  padding: 3px;
  border-radius: 18px;
  background: #eaecef;
  max-width: 300px;
  gap: 3px;
}

.seg-item {
  flex: 1;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 15px;
  font-size: 14px;
  font-weight: 400;
  color: #8a8f99;
  cursor: pointer;
  transition: all 0.2s;
}

.seg-item.active {
  background: #ffffff;
  font-weight: 600;
  color: #1a1d26;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

/* 树形卡片 */
.tree-card.glass {
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.tree-card :deep(.el-card__body) {
  padding: 8px 12px;
}

.tree-list {
  min-height: 120px;
}

/* 行 */
.t-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 52px;
  border-radius: 10px;
  transition: background 0.15s;
}

.t-row:hover {
  background: rgba(0, 0, 0, 0.03);
}

.t-row-parent {
  height: 58px;
}

.t-chevron {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #8a8f99;
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
}

.t-chevron:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1a1d26;
}

.t-chevron-empty {
  cursor: default;
}

.t-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.t-icon .el-icon {
  color: inherit;
}

.icon-folder {
  background: #fff6e0;
  color: #f0a33c;
}

.icon-leaf {
  background: #e9f9f0;
  color: #3ba55d;
}

.t-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: #1a1d26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-row-parent .t-name {
  font-size: 16px;
  font-weight: 600;
}

.t-badge {
  flex-shrink: 0;
  padding: 2px 9px;
  border-radius: 10px;
  background: #edf1fb;
  color: #8a8f99;
  font-size: 12px;
}

.t-ops {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.t-ops :deep(.el-button) {
  font-size: 13px;
}

/* 虚线添加行 */
.t-add {
  padding: 2px 8px 6px 0;
}

.t-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 38px;
  border: 1px dashed rgba(46, 107, 230, 0.5);
  border-radius: 10px;
  background: #f6f8fc;
  color: #2e6be6;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.t-add-btn:hover {
  background: #eef3ff;
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

@media (max-width: 767px) {
  .page-header {
    align-items: flex-start;
  }

  .page-header :deep(.el-button) {
    padding: 8px 14px;
    font-size: 13px;
  }

  .seg-control {
    max-width: 100%;
  }

  .t-row,
  .t-row-parent {
    height: 48px;
  }

  .t-ops :deep(.el-button) {
    padding: 4px 6px;
  }
}
</style>
