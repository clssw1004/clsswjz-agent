<template>
  <div class="acts">
    <!-- ===== 顶部：标题 + 新建活动 ===== -->
    <div class="acts-head">
      <div class="acts-title-row">
        <h2>活动打卡</h2>
        <span class="acts-count">{{ defs.length }} 项</span>
      </div>
      <el-button type="primary" round class="acts-add" @click="goNewDef">
        <el-icon style="margin-right: 4px"><Plus /></el-icon>
        新建活动
      </el-button>
    </div>

    <!-- ===== 统计卡（今日 / 连续 / 累计） ===== -->
    <div class="acts-stats glass-card">
      <div class="stat-item">
        <span class="stat-v primary">{{ todayTotal }}</span>
        <span class="stat-l">今日打卡</span>
      </div>
      <span class="stat-div"></span>
      <div class="stat-item">
        <span class="stat-v">{{ streakDays }}</span>
        <span class="stat-l">连续打卡</span>
      </div>
      <span class="stat-div"></span>
      <div class="stat-item">
        <span class="stat-v">{{ totalRecords }}</span>
        <span class="stat-l">累计打卡</span>
      </div>
    </div>

    <!-- ===== 活动卡片列表 ===== -->
    <div v-loading="defsLoading" class="acts-list">
      <el-empty v-if="!defsLoading && defs.length === 0" description="暂无活动，点右上角新建一个" />
      <div
        v-for="d in defs"
        :key="d.id"
        class="act-card"
        @click="openDetail(d)"
      >
        <span class="act-emoji" :style="{ background: colorHex(d.color) + '22' }">{{ d.emoji || '🎯' }}</span>
        <div class="act-info">
          <span class="act-name">{{ d.name }}</span>
          <span class="act-sub">每日 {{ d.maxDailyCount || '不限' }} 次 · 已打卡 {{ todayCountOf(d) }}/{{ d.maxDailyCount || '∞' }}</span>
        </div>
        <el-icon class="act-arrow" :size="16"><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- ===== 打卡记录：日期分组 ===== -->
    <div class="acts-head records-head">
      <div class="acts-title-row">
        <h2>打卡记录</h2>
        <span class="acts-count">{{ filteredRecords.length }} 条</span>
      </div>
      <el-button type="primary" round class="acts-add" :disabled="!defs.length" @click="openCheckin()">
        <el-icon style="margin-right: 4px"><Check /></el-icon>
        今日打卡
      </el-button>
    </div>

    <div class="rec-filter">
      <button class="rec-filter-chip" :class="{ on: !activeDefId }" @click="activeDefId = ''">全部</button>
      <button
        v-for="d in defs"
        :key="d.id"
        class="rec-filter-chip"
        :class="{ on: activeDefId === d.id }"
        :style="activeDefId === d.id ? { background: colorHex(d.color), color: '#fff' } : {}"
        @click="toggleFilter(d)"
      >
        {{ d.emoji }} {{ d.name }}
      </button>
    </div>

    <div v-loading="recordsLoading" class="rec-list">
      <el-empty v-if="!recordsLoading && filteredRecords.length === 0" :description="activeDef ? '该活动还没有打卡记录' : '点击活动卡片 +1 打卡'" />
      <div v-for="group in groupedRecords" :key="group.date" class="rec-group">
        <div class="group-date">
          <span class="date-main">{{ group.date }}</span>
          <span v-if="group.tag" class="date-tag">{{ group.tag }}</span>
          <span class="date-sub">{{ group.weekday }}</span>
          <span class="date-count">{{ group.list.length }} 条</span>
        </div>
        <div v-for="r in group.list" :key="r.id" class="rec-card glass-card" @click="openDetailByRecord(r)">
          <span class="rec-emoji" :style="{ background: emojiBg(r) }">{{ emojiOf(r) }}</span>
          <div class="rec-body">
            <div class="rec-title">
              <span class="rec-name">{{ r.activityName }}</span>
              <span v-if="recTime(r)" class="rec-time">{{ recTime(r) }}</span>
            </div>
            <div v-if="r.location || r.remark" class="rec-sub">
              <span v-if="r.location" class="rec-loc"><el-icon :size="12"><Location /></el-icon>{{ r.location }}</span>
              <span v-if="r.remark" class="rec-remark">{{ r.remark }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 添加打卡：底部抽屉 ===== -->
    <el-drawer v-model="checkinVisible" direction="btt" size="auto" :with-header="false" :append-to-body="false" class="sheet-drawer">
      <div class="sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-head">
          <span class="sheet-title">添加打卡</span>
          <button class="sheet-close" @click="checkinVisible = false">×</button>
        </div>
        <div class="sheet-body">
          <span class="sheet-label">选择活动</span>
          <div class="sheet-chips">
            <button
              v-for="d in defs"
              :key="d.id"
              class="sheet-chip"
              :class="{ on: checkinForm.activityDefId === d.id }"
              :style="checkinForm.activityDefId === d.id ? { background: colorHex(d.color) } : {}"
              @click="checkinForm.activityDefId = d.id"
            >
              <span>{{ d.emoji || '🎯' }}</span>{{ d.name }}
            </button>
          </div>
          <span class="sheet-label">打卡日期</span>
          <div class="sheet-row">
            <el-date-picker
              v-model="checkinForm.recordDate"
              type="date"
              value-format="YYYY-MM-DD"
              format="YYYY/MM/DD"
              :clearable="false"
              size="large"
              class="sheet-row-picker"
            />
          </div>
          <span class="sheet-label">打卡说明</span>
          <div class="sheet-row sheet-row-area">
            <el-input
              v-model="checkinForm.remark"
              type="textarea"
              :rows="2"
              maxlength="100"
              placeholder="记录一下感受，如：5km 配速、状态不错"
              class="sheet-row-input"
            />
          </div>
        </div>
        <el-button type="primary" round size="large" class="sheet-save" :loading="savingCheckin" @click="submitCheckin">
          <el-icon style="margin-right: 4px"><Check /></el-icon>保存打卡
        </el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Check, Location, ArrowRight } from '@element-plus/icons-vue';
import { activityDefApi, activityRecordApi } from '@/api';
import { useAppStore } from '@/stores/app';

const router = useRouter();

const PRESET_COLORS = [
  { idx: 0, hex: '#a78bfa' }, { idx: 1, hex: '#22d3ee' }, { idx: 2, hex: '#10b981' },
  { idx: 3, hex: '#fbbf24' }, { idx: 4, hex: '#f472b6' }, { idx: 5, hex: '#fb7185' },
  { idx: 6, hex: '#60a5fa' }, { idx: 7, hex: '#fb923c' },
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

const totalRecords = computed(() => records.value.length);
const todayTotal = computed(() => records.value.filter((r) => (r.recordDate || '').slice(0, 10) === todayStr()).length);

/** 连续打卡天数（按 recordDate 去重，从今天往前推连续天数） */
const streakDays = computed(() => {
  const dates = new Set(records.value.map((r) => (r.recordDate || '').slice(0, 10)).filter(Boolean));
  let streak = 0;
  const d = new Date();
  while (dates.has(fmtDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
});

const groupedRecords = computed(() => {
  const groups: Record<string, any[]> = {};
  for (const r of filteredRecords.value) {
    const d = (r.recordDate || '').slice(0, 10);
    if (!d) continue;
    (groups[d] ??= []).push(r);
  }
  const today = todayStr();
  const yesterday = fmtDate(new Date(Date.now() - 86400000));
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      weekday: weekdayOf(date),
      tag: date === today ? '今天' : date === yesterday ? '昨天' : '',
      list,
    }));
});

function fmtDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  return fmtDate(new Date());
}

function weekdayOf(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

function todayCountOf(d: any) {
  const today = todayStr();
  return records.value.filter((r) => r.activityDefId === d.id && (r.recordDate || '').slice(0, 10) === today).length;
}

function emojiOf(record: any) {
  if (record.activityDefId) {
    const d = defs.value.find((x) => x.id === record.activityDefId);
    if (d?.emoji) return d.emoji;
  }
  return '🎯';
}

function emojiBg(record: any) {
  if (record.activityDefId) {
    const d = defs.value.find((x) => x.id === record.activityDefId);
    if (d) return colorHex(d.color) + '22';
  }
  return '#f0f1f4';
}

/** 记录卡时间：recordDate 中携带的 HH:mm */
function recTime(record: any) {
  const m = /(\d{1,2}):(\d{2})/.exec(record.recordDate || '');
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function toggleFilter(d: any) {
  activeDefId.value = activeDefId.value === d.id ? '' : d.id;
}

function goNewDef() {
  router.push('/activities/def/new');
}

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

// ===== 活动详情（整页跳转） =====
function openDetail(def: any) {
  router.push(`/activities/${def.id}`);
}

function openDetailByRecord(record: any) {
  if (record.activityDefId) router.push(`/activities/${record.activityDefId}`);
}

// ===== 添加打卡 =====
const checkinVisible = ref(false);
const savingCheckin = ref(false);
const checkinForm = reactive({ activityDefId: '', recordDate: todayStr(), remark: '' });

function openCheckin(def?: any) {
  checkinForm.activityDefId = def?.id || activeDef.value?.id || defs.value[0]?.id || '';
  checkinForm.recordDate = todayStr();
  checkinForm.remark = '';
  checkinVisible.value = true;
}

async function submitCheckin() {
  if (!checkinForm.activityDefId) {
    ElMessage.warning('请选择活动');
    return;
  }
  const def = defs.value.find((d) => d.id === checkinForm.activityDefId);
  if (!def) return;
  if (def.maxDailyCount) {
    const count = records.value.filter(
      (r) => r.activityDefId === def.id && (r.recordDate || '').slice(0, 10) === checkinForm.recordDate,
    ).length;
    if (count >= def.maxDailyCount) {
      ElMessage.warning(`该日打卡已达上限 ${def.maxDailyCount} 次`);
      return;
    }
  }
  savingCheckin.value = true;
  try {
    await activityRecordApi.create({
      activityDefId: def.id,
      activityName: def.name,
      recordDate: checkinForm.recordDate,
      remark: checkinForm.remark.trim() || null,
      maxDailyCount: def.maxDailyCount ?? null,
      accountBookId: app.currentBookId,
    });
    ElMessage.success('打卡成功');
    checkinVisible.value = false;
    await loadRecords();
  } catch (e: any) {
    ElMessage.error(e?.message || '打卡失败');
  } finally {
    savingCheckin.value = false;
  }
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

async function loadAll() {
  await Promise.all([loadDefs(), loadRecords()]);
}

onMounted(loadAll);
watch(() => app.currentBookId, loadAll);
</script>

<style scoped>
.acts {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 24px;
}

/* ===== 头部 ===== */
.acts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 12px 0;
  gap: 12px;
}

.acts-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.acts-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1d26;
}

.acts-count {
  font-size: 12px;
  color: #8a8f99;
}

.acts-head :deep(.el-button--primary) {
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  border-radius: 18px;
}

.records-head {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid #eceef2;
}

/* ===== 玻璃卡片 ===== */
.glass-card {
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
}

/* ===== 统计卡 ===== */
.acts-stats {
  display: flex;
  align-items: center;
  padding: 14px 0;
  margin: 0 12px;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-v {
  font-size: 20px;
  font-weight: 700;
  color: #1a1d26;
  font-family: Inter, sans-serif;
}

.stat-v.primary {
  color: #2e6be6;
}

.stat-l {
  font-size: 11px;
  color: #9ca1ad;
}

.stat-div {
  width: 1px;
  height: 34px;
  background: #eceef2;
}

/* ===== 活动卡片 ===== */
.acts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px;
  min-height: 80px;
}

.act-card {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
  cursor: pointer;
  transition: all 0.15s ease;
}

.act-card.on {
  border-color: #2e6be6;
  box-shadow: 0 0 0 2px rgba(46, 107, 230, 0.15);
}

.act-card:hover {
  transform: translateY(-1px);
}

.act-emoji {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  font-size: 22px;
}

.act-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.act-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1d26;
}

.act-sub {
  font-size: 12px;
  color: #9ca1ad;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.act-arrow {
  flex-shrink: 0;
  color: #c6cbd6;
}

/* ===== 记录筛选 chips ===== */
.rec-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px;
}

.rec-filter-chip {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 16px;
  background: #f0f1f4;
  color: #8a8f99;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rec-filter-chip.on {
  background: #2e6be6;
  color: #fff;
  font-weight: 600;
}

/* ===== 记录分组 ===== */
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 12px;
  min-height: 80px;
}

.rec-group {
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
  color: #9ca1ad;
}

.date-main {
  font-size: 14px;
  font-weight: 700;
  color: #1a1d26;
}

.date-tag {
  font-size: 12px;
  color: #2e6be6;
  font-weight: 500;
}

.date-count {
  margin-left: auto;
}

.rec-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.rec-card:hover {
  transform: translateY(-1px);
  border-color: rgba(46, 107, 230, 0.35);
}

.rec-emoji {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 18px;
}

.rec-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1d26;
}

.rec-time {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: #8a8f99;
  flex-shrink: 0;
}

.rec-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rec-loc {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #9ca1ad;
  flex-shrink: 0;
}

.rec-remark {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #8a8f99;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 抽屉 ===== */
.sheet {
  padding: 0 20px 20px;
}

.sheet-grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #d8dbe0;
  margin: 8px auto 10px;
}

.sheet-head {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1d26;
  flex: 1;
}

.sheet-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f0f1f4;
  color: #8a8f99;
  font-size: 16px;
  cursor: pointer;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-label {
  font-size: 13px;
  font-weight: 500;
  color: #8a8f99;
  margin-top: 4px;
}

.sheet-label:first-child {
  margin-top: 0;
}

.sheet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.sheet-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: none;
  border-radius: 19px;
  background: #f0f1f4;
  color: #8a8f99;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sheet-chip.on {
  color: #fff;
  font-weight: 600;
}

/* 日期 / 说明 行（圆角 12 灰底 46/64 高，对齐设计稿 4:453） */
.sheet-row {
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  background: #f6f8fc;
  display: flex;
  align-items: center;
}

.sheet-row-area {
  height: auto;
  min-height: 64px;
  padding: 8px 14px;
  align-items: stretch;
}

.sheet-row-picker {
  width: 100%;
}

.sheet-row-picker :deep(.el-input__wrapper) {
  box-shadow: none;
  background: transparent;
  padding: 0;
}

.sheet-row-picker :deep(.el-input__inner) {
  font-size: 14px;
  font-weight: 500;
  color: #1a1d26;
}

.sheet-row-input :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  resize: none;
  min-height: 48px;
}

.sheet-save {
  width: 100%;
  margin-top: 12px;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6) !important;
  border: none !important;
  color: #ffffff !important;
}

.sheet-save:hover,
.sheet-save:focus {
  background: linear-gradient(135deg, #5a9aff, #3a7bf0) !important;
  color: #ffffff !important;
}


</style>
