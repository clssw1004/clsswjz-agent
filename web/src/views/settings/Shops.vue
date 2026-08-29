<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>商家管理</h2>
        <span class="count">{{ filtered.length }} 家</span>
      </div>
      <div class="header-actions">
        <el-button :class="{ 'sort-active': sortByRecent }" round @click="toggleSort">
          <el-icon style="margin-right: 4px"><Clock /></el-icon>
          最近使用
        </el-button>
        <el-button type="primary" round @click="openDialog()">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>
          新增商家
        </el-button>
      </div>
    </div>

    <el-card class="glass tree-card" shadow="never">
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索商家名称"
          clearable
          size="large"
          class="search-input"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div v-loading="loading" class="tree-list">
        <el-empty v-if="!loading && visibleTree.length === 0" description="暂无数据" />

        <template v-for="row in visibleTree" :key="row.id">
          <div
            class="t-row"
            :class="{ 't-row-parent': row._children.length > 0 }"
            :style="{ paddingLeft: 12 + row._depth * 18 + 'px' }"
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
            <span v-if="row._children.length > 0" class="t-badge t-push">{{ row._children.length }}</span>
            <span v-else-if="row.lastAccountItemAt" class="t-meta t-push">最近 {{ formatRecent(row.lastAccountItemAt) }}</span>

            <span class="t-ops">
              <button class="t-op add" title="添加子商户" @click="openDialog(undefined, row)">
                <el-icon :size="16"><Plus /></el-icon>
              </button>
              <button class="t-op" title="编辑" @click="openDialog(row)">
                <el-icon :size="15"><EditPen /></el-icon>
              </button>
              <button class="t-op danger" title="删除" @click="remove(row)">
                <el-icon :size="15"><Delete /></el-icon>
              </button>
            </span>
          </div>
        </template>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑商家' : '新增商家'"
      width="min(440px, 90vw)"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" size="large" />
        </el-form-item>
        <el-form-item label="记账可选">
          <div class="switch-row">
            <el-switch v-model="form.isBookkeepingSelectable" />
            <span class="switch-label">{{ form.isBookkeepingSelectable ? '记账时可选' : '隐藏' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="上级商户">
          <el-select v-model="form.parentId" placeholder="无（顶级商户）" clearable style="width: 100%" size="large">
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
import { Plus, ArrowDown, ArrowRight, Folder, FolderOpened, Document, Search, Clock, EditPen, Delete } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { shopApi } from '@/api';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const items = ref<any[]>([]);
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

/** 排序：false = sortOrder，true = 最近使用(lastAccountItemAt 倒序) */
const sortByRecent = ref(false);
/** 折叠的父级 id 集合 */
const collapsedIds = ref<Set<string>>(new Set());

const form = reactive({ id: '', name: '', parentId: '', isBookkeepingSelectable: true });

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter(
    (i) => String(i.name || '').toLowerCase().includes(k),
  );
});

/** 构建树：标记 _depth 与 _children（直接子级） */
function buildTree(list: any[], parentId = '', depth = 0): any[] {
  return list
    .filter((i) => (i.parentId || '') === parentId)
    .sort((a, b) => {
      if (sortByRecent.value) {
        const at = (x: any) => (x.lastAccountItemAt ? new Date(x.lastAccountItemAt).getTime() : 0);
        return at(b) - at(a);
      }
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    })
    .map((node) => ({
      ...node,
      _depth: depth,
      _children: buildTree(list, node.id, depth + 1),
    }));
}

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
  walk(buildTree(filtered.value));
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

function toggleSort() {
  sortByRecent.value = !sortByRecent.value;
  collapsedIds.value = new Set();
}

/** 相对时间：xx分钟前 / xx小时前 / xx天前 / M-D */
function formatRecent(ts?: string) {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

/** 上级商户候选（排除自身及子级） */
const parentCandidates = computed(() => {
  const candidates = items.value.filter((i) => i.id !== form.id);
  return buildTree(candidates);
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

function openDialog(row?: any, parent?: any) {
  Object.assign(form, {
    id: row?.id || '',
    name: row?.name || '',
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
      parentId: form.parentId || null,
      isBookkeepingSelectable: form.isBookkeepingSelectable,
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
watch(() => appStore.currentBookId, load);
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 8px;
  gap: 12px;
  flex-wrap: wrap;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions :deep(.el-button--primary) {
  background: var(--grad-brand);
  border: none;
  box-shadow: var(--glow-primary);
}

.header-actions :deep(.el-button).sort-active {
  background: #edf1fb;
  border-color: rgba(46, 107, 230, 0.4);
  color: #2e6be6;
}

.toolbar {
  margin-bottom: 12px;
}

.search-input {
  max-width: 320px;
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
  padding: 4px 10px;
}

.tree-list {
  min-height: 80px;
}

/* 行 */
.t-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  height: 44px;
  border-radius: 10px;
  transition: background 0.15s;
}

.t-row:hover {
  background: rgba(0, 0, 0, 0.03);
}

.t-row-parent {
  height: 50px;
}

.t-chevron {
  width: 20px;
  height: 20px;
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
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
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
  min-width: 0;
  font-size: 15px;
  color: #1a1d26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-push {
  margin-left: auto;
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

.t-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: #9ca1ad;
}

.t-ops {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.t-op {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #8a8f99;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.t-op:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1a1d26;
}

.t-op.add {
  color: #2e6be6;
}

.t-op.add:hover {
  background: rgba(46, 107, 230, 0.1);
  color: #2e6be6;
}

.t-op.danger:hover {
  background: rgba(242, 87, 62, 0.1);
  color: #f2573e;
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
    padding: 8px 12px;
    font-size: 13px;
  }

  .search-input {
    max-width: 100%;
  }

  .t-row,
  .t-row-parent {
    height: 48px;
  }
}
</style>
