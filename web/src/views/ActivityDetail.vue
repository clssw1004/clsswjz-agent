<template>
  <div class="dp">
    <!-- ===== Hero：emoji + 名称 + 累计 + 已达上限（顶部固定，不滚） ===== -->
    <div class="dp-hero" :style="{ background: heroBg }">
      <div class="dp-hero-actions">
        <button class="dp-op" title="编辑活动" @click="goEditDef"><el-icon :size="15"><EditPen /></el-icon></button>
        <button class="dp-op danger" title="删除活动" @click="removeDef"><el-icon :size="15"><Delete /></el-icon></button>
      </div>
      <span class="dp-emoji">{{ def?.emoji || '🎯' }}</span>
      <span class="dp-name">{{ def?.name || '活动' }}</span>
      <div class="dp-count">
        <span class="dp-count-v">{{ records.length }}</span>
        <span class="dp-count-l">累计打卡</span>
      </div>
      <div v-if="def?.maxDailyCount && todayCount >= def.maxDailyCount" class="dp-hint">
        <el-icon :size="13" style="margin-right: 4px"><Warning /></el-icon>今日已达上限 {{ def.maxDailyCount }} 次
      </div>
    </div>

    <!-- ===== 最近打卡列表（独立滚动） ===== -->
    <div v-loading="loading" class="dp-section">
      <span class="dp-section-title">最近打卡</span>
      <el-empty v-if="!loading && records.length === 0" description="暂无打卡记录" :image-size="60" />
      <div v-for="r in records" :key="r.id" class="dp-rec">
        <span class="dp-av">我</span>
        <div class="dp-rec-body">
          <span class="dp-rec-time">{{ recTime(r) }}</span>
          <span v-if="r.remark" class="dp-rec-remark">{{ r.remark }}</span>
          <span v-if="r.location" class="dp-rec-loc"><el-icon :size="11"><Location /></el-icon>{{ r.location }}</span>
        </div>
        <div class="dp-rec-ops">
          <button class="dp-rec-op" title="编辑记录" @click="openEditRecord(r)"><el-icon :size="14"><EditPen /></el-icon></button>
          <button class="dp-rec-op danger" title="删除记录" @click="removeRecord(r)"><el-icon :size="14"><Delete /></el-icon></button>
        </div>
      </div>
    </div>

    <!-- ===== 编辑打卡记录弹窗 ===== -->
    <el-dialog v-model="recEditVisible" title="编辑打卡" width="min(420px, 92vw)" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="打卡时间">
          <el-date-picker
            v-model="recForm.recordDate"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm"
            format="YYYY/MM/DD HH:mm"
            style="width: 100%"
            size="large"
          />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="recForm.location" placeholder="选填" maxlength="50" size="large" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="recForm.remark" type="textarea" :rows="2" maxlength="100" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="recEditVisible = false">取消</el-button>
        <el-button type="primary" round :loading="savingRec" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Delete, EditPen, Location, Warning } from '@element-plus/icons-vue';
import { activityDefApi, activityRecordApi } from '@/api';
import { useAppStore } from '@/stores/app';

const PRESET_COLORS = [
  { idx: 0, hex: '#a78bfa' }, { idx: 1, hex: '#22d3ee' }, { idx: 2, hex: '#10b981' },
  { idx: 3, hex: '#fbbf24' }, { idx: 4, hex: '#f472b6' }, { idx: 5, hex: '#fb7185' },
  { idx: 6, hex: '#60a5fa' }, { idx: 7, hex: '#fb923c' },
];

function colorHex(idx?: number) {
  const i = typeof idx === 'number' ? idx : 0;
  return PRESET_COLORS[i]?.hex || PRESET_COLORS[0].hex;
}

function fmtDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekdayOf(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

const route = useRoute();
const router = useRouter();
const app = useAppStore();

const defId = String(route.params.id || '');
const loading = ref(false);
const def = ref<any>(null);
const records = ref<any[]>([]);

const heroBg = computed(() => colorHex(def.value?.color) + '22');

const todayCount = computed(() => {
  const today = fmtDate(new Date());
  return records.value.filter((r) => (r.recordDate || '').slice(0, 10) === today).length;
});

function recTime(r: any) {
  const d = (r.recordDate || '').slice(0, 10);
  if (!d) return '-';
  const m = /(\d{1,2}):(\d{2})/.exec(r.recordDate || '');
  const t = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  return t ? `${d} ${weekdayOf(d)} ${t}` : `${d} ${weekdayOf(d)}`;
}

async function load() {
  loading.value = true;
  try {
    const [defsRes, recsRes]: any[] = await Promise.all([
      activityDefApi.list({ accountBookId: app.currentBookId }),
      activityRecordApi.list({ accountBookId: app.currentBookId }),
    ]);
    const defs = Array.isArray(defsRes) ? defsRes : defsRes?.items || [];
    const recs = Array.isArray(recsRes) ? recsRes : recsRes?.items || [];
    def.value = defs.find((d: any) => d.id === defId) || null;
    records.value = recs
      .filter((r: any) => r.activityDefId === defId)
      .sort((a: any, b: any) => (b.recordDate || '').localeCompare(a.recordDate || ''));
  } finally {
    loading.value = false;
  }
}

// ===== 编辑活动（整页路由） =====
function goEditDef() {
  router.push(`/activities/def/${defId}/edit`);
}

// ===== 删除活动 =====
async function removeDef() {
  if (!def.value) return;
  await ElMessageBox.confirm(`确定删除活动「${def.value.name}」吗？相关打卡记录也会被删除。`, '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  try {
    await activityDefApi.delete(defId);
    ElMessage.success('删除成功');
    router.replace('/activities');
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}

// ===== 编辑/删除打卡记录 =====
const recEditVisible = ref(false);
const savingRec = ref(false);
const recForm = reactive({ id: '', recordDate: '', remark: '', location: '' });

function openEditRecord(r: any) {
  Object.assign(recForm, {
    id: r.id,
    recordDate: (r.recordDate || '').slice(0, 16),
    remark: r.remark || '',
    location: r.location || '',
  });
  recEditVisible.value = true;
}

async function saveRecord() {
  if (!recForm.id || !recForm.recordDate) {
    ElMessage.warning('请选择打卡时间');
    return;
  }
  savingRec.value = true;
  try {
    await activityRecordApi.update(recForm.id, {
      recordDate: recForm.recordDate,
      remark: recForm.remark.trim() || null,
      location: recForm.location.trim() || null,
    });
    ElMessage.success('已更新');
    recEditVisible.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  } finally {
    savingRec.value = false;
  }
}

async function removeRecord(r: any) {
  await ElMessageBox.confirm('确定删除这条打卡记录吗？', '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  try {
    await activityRecordApi.delete(r.id);
    ElMessage.success('已删除');
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.dp {
  max-width: 480px;
  margin: 0 auto;
  /* max-height 而非固定 height：内容少时自适应（无空白），
     内容超过可视区时封顶，由 .dp-section 独立滚动；
     104 = Layout topbar 56 + content padding 上下 24*2；
     用 dvh 动态视口避免浏览器工具栏导致外部滚动条 */
  max-height: calc(100vh - 104px);
  max-height: calc(100dvh - 104px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== 顶部操作按钮（hero 右上角绝对定位） ===== */
.dp-op {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #8a8f99;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.dp-op:hover {
  background: #e4e6eb;
}

.dp-op.danger {
  color: #f2573e;
}

/* ===== Hero（顶部固定，不滚） ===== */
.dp-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin: 0 12px;
  padding: 18px 16px 16px;
  border-radius: 18px;
}

.dp-hero-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.dp-emoji {
  font-size: 52px;
  line-height: 1;
}

.dp-name {
  font-size: 20px;
  font-weight: 700;
  color: #1a1d26;
}

.dp-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 20px;
  border-radius: 16px;
  background: #fff;
  margin-top: 2px;
}

.dp-count-v {
  font-size: 28px;
  font-weight: 700;
  color: #6b46c1;
  line-height: 1.1;
}

.dp-count-l {
  font-size: 11px;
  color: #6b46c1;
}

.dp-hint {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 14px;
  background: rgba(245, 158, 11, 0.15);
  color: #e65100;
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}

/* ===== 最近打卡（独立滚动） ===== */
.dp-section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 12px;
}

.dp-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1d26;
  padding: 4px 0 2px;
  position: sticky;
  top: 0;
  background: #f6f7f9;
  z-index: 1;
}

.dp-rec {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  box-shadow: 0 2px 8px rgba(26, 29, 38, 0.05);
}

.dp-av {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(107, 70, 193, 0.35);
  color: #6b46c1;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dp-rec-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dp-rec-time {
  font-size: 14px;
  font-weight: 700;
  color: #1a1d26;
}

.dp-rec-remark {
  font-size: 11px;
  color: #9ca1ad;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-rec-loc {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #9ca1ad;
}

.dp-rec-ops {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.dp-rec-op {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f0f1f4;
  color: #8a8f99;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.dp-rec-op:hover {
  background: #e4e6eb;
}

.dp-rec-op.danger {
  color: #f2573e;
}
</style>
