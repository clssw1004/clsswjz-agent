<template>
  <div class="activities-page">
    <!-- ===== 活动定义区 ===== -->
    <div class="page-header">
      <div class="page-header-title">
        <h2>活动定义</h2>
        <span class="count">{{ defs.length }} 项</span>
      </div>
      <el-button type="primary" round @click="openDefDialog()">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新建活动
      </el-button>
    </div>

    <div v-loading="defsLoading" class="def-cloud">
      <el-empty v-if="!defsLoading && defs.length === 0" description="暂无活动，点右上角新建一个" />
      <div
        v-for="d in defs"
        :key="d.id"
        class="def-chip"
        :class="{ on: activeDefId === d.id }"
        :style="{ '--def-color': colorHex(d.color) }"
        @click="selectDef(d)"
      >
        <span class="def-emoji">{{ d.emoji || '🎯' }}</span>
        <div class="def-meta">
          <span class="def-name">{{ d.name }}</span>
          <span v-if="d.maxDailyCount" class="def-badge">每日 {{ d.maxDailyCount }} 次</span>
        </div>
        <el-dropdown trigger="click" @click.stop @command="(cmd: string) => handleDefCmd(cmd, d)">
          <el-icon class="def-more"><MoreFilled /></el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">编辑</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- ===== 打卡记录区 ===== -->
    <div class="page-header records-header">
      <div class="page-header-title">
        <h2>打卡记录</h2>
        <span class="count">{{ filteredRecords.length }} 条</span>
      </div>
      <el-button
        type="primary"
        round
        :disabled="!activeDef"
        @click="checkIn"
      >
        <el-icon style="margin-right: 4px"><Check /></el-icon>
        今日打卡
      </el-button>
    </div>

    <div v-if="activeDef" class="filter-hint">
      当前查看：<b>{{ activeDef.emoji }} {{ activeDef.name }}</b>
      <button class="clear-filter" @click="activeDefId = ''">清除筛选</button>
    </div>

    <div v-loading="recordsLoading" class="record-list">
      <el-empty v-if="!recordsLoading && filteredRecords.length === 0" :description="activeDef ? '该活动还没有打卡记录' : '选择活动或直接打卡'" />

      <div v-for="group in groupedRecords" :key="group.date" class="record-group">
        <div class="group-date">
          <span class="date-main">{{ group.date }}</span>
          <span class="date-sub">{{ group.weekday }}</span>
          <span class="date-count">{{ group.list.length }} 条</span>
        </div>
        <div
          v-for="r in group.list"
          :key="r.id"
          class="record-card glass"
        >
          <div class="record-emoji">
            <span>{{ emojiOf(r) }}</span>
          </div>
          <div class="record-body">
            <div class="record-title-row">
              <span class="record-name">{{ r.activityName }}</span>
              <span v-if="r.location" class="record-loc">
                <el-icon :size="12"><Location /></el-icon>
                {{ r.location }}
              </span>
            </div>
            <p v-if="r.remark" class="record-remark">{{ r.remark }}</p>
          </div>
          <el-button class="del-btn" link type="danger" @click="removeRecord(r)">
            <el-icon :size="16"><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- ===== 活动定义编辑弹窗 ===== -->
    <el-dialog
      v-model="defDialogVisible"
      :title="defForm.id ? '编辑活动' : '新建活动'"
      width="420px"
      destroy-on-close
    >
      <el-form ref="defFormRef" :model="defForm" :rules="defRules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="defForm.name" placeholder="如：晨跑、冥想" maxlength="20" size="large" />
        </el-form-item>
        <el-form-item label="Emoji" prop="emoji">
          <el-input v-model="defForm.emoji" placeholder="如：🏃 🧘 💧" maxlength="8" size="large" />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <div class="color-row">
            <button
              v-for="c in PRESET_COLORS"
              :key="c.hex"
              type="button"
              class="color-dot"
              :class="{ on: defForm.color === c.idx }"
              :style="{ background: c.hex }"
              @click="defForm.color = c.idx"
            />
          </div>
        </el-form-item>
        <el-form-item label="每日最多打卡次数">
          <el-input-number v-model="defForm.maxDailyCount" :min="1" :max="99" placeholder="不填则不限制" />
          <span class="form-hint">不填则视为不限制</span>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="defForm.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="defDialogVisible = false">取消</el-button>
        <el-button type="primary" round :loading="savingDef" @click="saveDef">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Plus, Check, MoreFilled, Delete, Location } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { activityDefApi, activityRecordApi } from '@/api';
import { useAppStore } from '@/stores/app';

const PRESET_COLORS = [
  { idx: 0, hex: '#a78bfa' }, // 紫
  { idx: 1, hex: '#22d3ee' }, // 青
  { idx: 2, hex: '#10b981' }, // 绿
  { idx: 3, hex: '#fbbf24' }, // 黄
  { idx: 4, hex: '#f472b6' }, // 粉
  { idx: 5, hex: '#fb7185' }, // 红
  { idx: 6, hex: '#60a5fa' }, // 蓝
  { idx: 7, hex: '#fb923c' }, // 橙
];

function colorHex(idx?: number) {
  const i = typeof idx === 'number' ? idx : 0;
  return PRESET_COLORS[i]?.hex || PRESET_COLORS[0].hex;
}

const app = useAppStore();

const defs = ref<any[]>([]);
const records = ref<any[]>([]);
const defsLoading = ref(false);
const recordsLoading = ref(false);
const activeDefId = ref('');

const activeDef = computed(() => defs.value.find((d) => d.id === activeDefId.value) || null);
const filteredRecords = computed(() =>
  activeDefId.value ? records.value.filter((r) => r.activityDefId === activeDefId.value) : records.value,
);

const groupedRecords = computed(() => {
  const groups: Record<string, any[]> = {};
  for (const r of filteredRecords.value) {
    const d = (r.recordDate || '').slice(0, 10);
    if (!d) continue;
    (groups[d] ??= []).push(r);
  }
  const sorted = Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, weekday: weekdayOf(date), list }));
  return sorted;
});

function weekdayOf(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

function emojiOf(record: any) {
  if (record.activityDefId) {
    const d = defs.value.find((x) => x.id === record.activityDefId);
    if (d?.emoji) return d.emoji;
  }
  return '🎯';
}

// ===== 活动定义 =====
const defDialogVisible = ref(false);
const savingDef = ref(false);
const defFormRef = ref<FormInstance>();
const defForm = reactive({
  id: '',
  name: '',
  emoji: '🎯',
  color: 0,
  sortOrder: 0,
  maxDailyCount: undefined as number | undefined,
});

const defRules: FormRules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  emoji: [{ required: true, message: '请输入 emoji', trigger: 'blur' }],
};

async function loadDefs() {
  defsLoading.value = true;
  try {
    const res: any = await activityDefApi.list({ accountBookId: app.currentBookId });
    defs.value = Array.isArray(res) ? res : res?.items || [];
    defs.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  } finally {
    defsLoading.value = false;
  }
}

function openDefDialog(row?: any) {
  Object.assign(defForm, {
    id: row?.id || '',
    name: row?.name || '',
    emoji: row?.emoji || '🎯',
    color: typeof row?.color === 'number' ? row.color : 0,
    sortOrder: row?.sortOrder ?? 0,
    maxDailyCount: row?.maxDailyCount,
  });
  defDialogVisible.value = true;
}

async function saveDef() {
  const valid = await defFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  savingDef.value = true;
  try {
    const data: any = {
      name: defForm.name,
      emoji: defForm.emoji,
      color: defForm.color,
      sortOrder: defForm.sortOrder,
      accountBookId: app.currentBookId,
    };
    if (defForm.maxDailyCount !== undefined && defForm.maxDailyCount !== null) {
      data.maxDailyCount = defForm.maxDailyCount;
    } else {
      data.maxDailyCount = null;
    }
    if (defForm.id) await activityDefApi.update(defForm.id, data);
    else await activityDefApi.create(data);
    ElMessage.success(defForm.id ? '更新成功' : '创建成功');
    defDialogVisible.value = false;
    await loadDefs();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    savingDef.value = false;
  }
}

async function removeDef(row: any) {
  await ElMessageBox.confirm(`确定删除活动「${row.name}」吗？相关打卡记录也会被删除。`, '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  await activityDefApi.delete(row.id);
  ElMessage.success('删除成功');
  if (activeDefId.value === row.id) activeDefId.value = '';
  await loadDefs();
  await loadRecords();
}

function handleDefCmd(cmd: string, row: any) {
  if (cmd === 'edit') openDefDialog(row);
  else if (cmd === 'delete') removeDef(row).catch(() => {});
}

function selectDef(d: any) {
  activeDefId.value = activeDefId.value === d.id ? '' : d.id;
}

// ===== 打卡记录 =====
async function loadRecords() {
  recordsLoading.value = true;
  try {
    const res: any = await activityRecordApi.list({ accountBookId: app.currentBookId });
    records.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    recordsLoading.value = false;
  }
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function checkIn() {
  if (!activeDef.value) return;
  const today = todayStr();
  // 检查今日打卡次数是否已达上限
  if (activeDef.value.maxDailyCount) {
    const todayCount = records.value.filter(
      (r) => r.activityDefId === activeDef.value.id && (r.recordDate || '').slice(0, 10) === today,
    ).length;
    if (todayCount >= activeDef.value.maxDailyCount) {
      ElMessage.warning(`今日打卡已达上限 ${activeDef.value.maxDailyCount} 次`);
      return;
    }
  }
  try {
    await activityRecordApi.create({
      activityDefId: activeDef.value.id,
      activityName: activeDef.value.name,
      recordDate: today,
      accountBookId: app.currentBookId,
    });
    ElMessage.success('打卡成功');
    await loadRecords();
  } catch (e: any) {
    ElMessage.error(e?.message || '打卡失败');
  }
}

async function removeRecord(row: any) {
  await ElMessageBox.confirm('确定删除这条打卡记录吗？', '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  await activityRecordApi.delete(row.id);
  ElMessage.success('已删除');
  records.value = records.value.filter((r) => r.id !== row.id);
}

async function loadAll() {
  await Promise.all([loadDefs(), loadRecords()]);
}

onMounted(loadAll);
watch(() => app.currentBookId, loadAll);
</script>

<style scoped>
.activities-page {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 4px 0;
  gap: 12px;
}

.page-header-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.count {
  font-size: 12px;
  color: var(--text-3);
}

.page-header :deep(.el-button--primary) {
  background: var(--grad-brand);
  border: none;
  box-shadow: var(--glow-primary);
}

.records-header {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-glass);
}

/* ===== 活动定义 chips ===== */
.def-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  min-height: 64px;
}

.def-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px 9px 14px;
  border-radius: 14px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass);
  cursor: pointer;
  transition: all 0.18s ease;
  position: relative;
  --def-color: #a78bfa;
}

.def-chip::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: var(--def-color);
  opacity: 0.08;
  pointer-events: none;
}

.def-chip:hover {
  transform: translateY(-1px);
  border-color: var(--def-color);
}

.def-chip.on {
  background: var(--def-color);
  border-color: transparent;
  color: #fff;
}

.def-chip.on .def-name,
.def-chip.on .def-badge {
  color: #fff;
}

.def-emoji {
  font-size: 18px;
  line-height: 1;
}

.def-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.def-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
}

.def-badge {
  font-size: 10px;
  color: var(--text-3);
}

.def-more {
  color: var(--text-3);
  padding: 4px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.def-more:hover {
  background: rgba(0, 0, 0, 0.08);
}

.def-chip.on .def-more {
  color: rgba(255, 255, 255, 0.85);
}

/* ===== 筛选提示 ===== */
.filter-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.clear-filter {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--brand-gold-dark);
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

/* ===== 记录分组 ===== */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.record-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-date {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-3);
}

.date-main {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.date-count {
  margin-left: auto;
}

.record-card.glass {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.record-emoji {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: var(--surface-glass-strong);
  font-size: 18px;
}

.record-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.record-loc {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-3);
}

.record-remark {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-word;
}

.del-btn {
  flex-shrink: 0;
  padding: 4px;
}

/* ===== 表单 ===== */
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.color-dot:hover {
  transform: scale(1.1);
}

.color-dot.on {
  border-color: var(--text-1);
  box-shadow: 0 0 0 2px var(--surface-glass-strong);
}

.form-hint {
  margin-left: 8px;
  font-size: 11px;
  color: var(--text-3);
}

@media (max-width: 767px) {
  .page-header h2 {
    font-size: 15px;
  }
  .def-chip {
    padding: 7px 10px 7px 12px;
  }
}
</style>