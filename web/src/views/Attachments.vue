<template>
  <div class="att">
    <!-- ===== 头部：标题 + 计数 + 刷新 ===== -->
    <div class="att-head">
      <div class="att-title-row">
        <h2>附件</h2>
        <span class="att-count">{{ total }} 个</span>
      </div>
      <el-button type="primary" round class="att-refresh" @click="reload">
        <el-icon style="margin-right: 4px"><RefreshRight /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- ===== 附件列表（对齐 gui AttachmentListPage） ===== -->
    <div v-loading="loading" class="att-list">
      <el-empty v-if="!loading && !list.length" description="暂无附件" :image-size="60" />

      <div v-for="a in list" :key="a.id" class="att-card" @click="open(a)">
        <!-- 类型图标：图片显示缩略图，其余按类型彩色图标 -->
        <div class="att-ic" :class="'t-' + typeOf(a)">
          <img v-if="isImage(a) && thumbMap[a.id]" :src="thumbMap[a.id]" class="att-thumb" alt="" />
          <el-icon v-else :size="26"><component :is="typeIcon(typeOf(a))" /></el-icon>
        </div>

        <div class="att-body">
          <span class="att-src">{{ a.businessName || bizLabel(a.businessCode) }}</span>
          <span class="att-name">{{ a.originName }}</span>
          <span class="att-meta">{{ fmtSize(a.fileLength) }} · {{ fmtTime(a.createdAt) }}</span>
        </div>

        <span class="att-open" title="打开"><el-icon :size="16"><ArrowRight /></el-icon></span>
        <button class="att-del" title="删除附件" @click.stop="remove(a)">
          <el-icon :size="15"><Delete /></el-icon>
        </button>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="loadingMore" class="att-more">
      <el-icon class="is-loading" :size="15"><Loading /></el-icon>
      <span>加载中…</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ArrowRight, Box, DataBoard, Delete, Document, Grid, Headset,
  Loading, Picture, RefreshRight, VideoCamera,
} from '@element-plus/icons-vue';
import { attachmentApi, loadAttachmentUrl } from '@/api';

const PAGE = 50;
const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const offset = ref(0);
/** 图片缩略图 objectURL 缓存 */
const thumbMap = reactive<Record<string, string>>({});

/* ===== 文件类型（对齐 gui _buildFileTypeIcon） ===== */
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];

function typeOf(a: any): string {
  const ext = (a.extension || '').toLowerCase();
  const ct = (a.contentType || '').toLowerCase();
  if (ct.startsWith('image/') || IMG_EXTS.includes(ext)) return 'img';
  if (ct.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
  if (ct.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx'].includes(ext)) return 'xls';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (ext === 'txt') return 'txt';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  return 'other';
}

function typeIcon(t: string) {
  const map: Record<string, any> = {
    img: Picture, video: VideoCamera, audio: Headset, pdf: Document,
    doc: Document, xls: Grid, ppt: DataBoard, txt: Document, zip: Box, other: Document,
  };
  return map[t];
}

function isImage(a: any): boolean {
  return typeOf(a) === 'img';
}

/** 业务类型中文兜底（businessName 为空时显示） */
const BIZ_LABEL: Record<string, string> = {
  item: '账目', note: '笔记', activity: '活动', activityDefinition: '活动',
  vehicle: '车辆', fuelRecord: '加油记录', giftCard: '礼物卡', debt: '债务',
};

function bizLabel(code: string) {
  return BIZ_LABEL[code] || '附件';
}

/* ===== 加载 ===== */
async function load() {
  if (loading.value || loadingMore.value) return;
  if (offset.value === 0) loading.value = true;
  else loadingMore.value = true;
  try {
    const res: any = await attachmentApi.list({ limit: PAGE, offset: offset.value });
    const items = Array.isArray(res) ? res : res?.items || [];
    total.value = Array.isArray(res) ? items.length : (res?.total ?? items.length);
    list.value = offset.value === 0 ? items : [...list.value, ...items];
    hasMore.value = items.length === PAGE;
    offset.value += items.length;
    // 图片附件懒加载缩略图（带鉴权 blob）
    items.filter(isImage).forEach((a) => loadThumb(a));
  } catch (e: any) {
    ElMessage.error(e?.message || '加载附件失败');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadThumb(a: any) {
  try {
    const url = await loadAttachmentUrl(a.id);
    if (list.value.some((x) => x.id === a.id)) thumbMap[a.id] = url;
  } catch { /* 缩略图失败回落类型图标 */ }
}

function reload() {
  offset.value = 0;
  hasMore.value = true;
  load();
}

/** 滚动到底自动加载更多 */
function onScroll() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140) {
    load();
  }
}

/* ===== 打开 ===== */
async function open(a: any) {
  try {
    const url = await loadAttachmentUrl(a.id);
    const inline = isImage(a) || (a.extension || '').toLowerCase() === 'pdf';
    if (inline) {
      window.open(url, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = a.originName || a.id;
      link.click();
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '打开附件失败');
  }
}

/* ===== 删除 ===== */
async function remove(a: any) {
  await ElMessageBox.confirm(`确定删除附件「${a.originName}」吗？`, '删除确认', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  });
  try {
    await attachmentApi.remove(a.id);
    ElMessage.success('已删除');
    list.value = list.value.filter((x) => x.id !== a.id);
    total.value = Math.max(0, total.value - 1);
    if (thumbMap[a.id]) URL.revokeObjectURL(thumbMap[a.id]);
    delete thumbMap[a.id];
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败');
  }
}

/* ===== 格式化 ===== */
function fmtSize(n: number) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtTime(t: number) {
  if (!t) return '';
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

onMounted(() => {
  load();
  window.addEventListener('scroll', onScroll);
});
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
  Object.values(thumbMap).forEach((u) => URL.revokeObjectURL(u));
});
</script>

<style scoped>
.att {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 24px;
}

/* ===== 头部 ===== */
.att-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 12px 0;
  gap: 12px;
}

.att-title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.att-title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1d26;
}

.att-count {
  font-size: 12px;
  color: #9ca1ad;
}

.att-refresh {
  flex-shrink: 0;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  border: none;
  font-weight: 600;
}

/* ===== 列表 ===== */
.att-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

.att-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px;
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.att-card:hover {
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.08);
  transform: translateY(-1px);
}

/* 类型图标块（56×56 圆角） */
.att-ic {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  overflow: hidden;
}

.att-ic.t-img { background: rgba(16, 185, 129, 0.14); color: #10b981; }
.att-ic.t-video { background: rgba(242, 87, 62, 0.14); color: #f2573e; }
.att-ic.t-audio { background: rgba(251, 146, 60, 0.14); color: #fb923c; }
.att-ic.t-pdf { background: rgba(242, 87, 62, 0.14); color: #f2573e; }
.att-ic.t-doc { background: rgba(96, 165, 250, 0.14); color: #60a5fa; }
.att-ic.t-xls { background: rgba(16, 185, 129, 0.14); color: #10b981; }
.att-ic.t-ppt { background: rgba(251, 146, 60, 0.14); color: #fb923c; }
.att-ic.t-txt { background: rgba(138, 143, 153, 0.12); color: #8a8f99; }
.att-ic.t-zip { background: rgba(167, 139, 250, 0.14); color: #a78bfa; }
.att-ic.t-other { background: rgba(138, 143, 153, 0.12); color: #8a8f99; }

.att-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 内容 */
.att-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.att-src {
  font-size: 14px;
  font-weight: 600;
  color: #1a1d26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att-name {
  font-size: 12px;
  color: #9ca1ad;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att-meta {
  font-size: 11px;
  color: #b0b5c0;
}

/* 右侧操作 */
.att-open {
  flex-shrink: 0;
  color: #c2c7d1;
}

.att-del {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9ca1ad;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.att-del:hover {
  background: rgba(242, 87, 62, 0.1);
  color: #f2573e;
}

/* 加载更多 */
.att-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0 4px;
  font-size: 12px;
  color: #9ca1ad;
}

html.dark .att-card {
  background: #1e2130;
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .att-title-row h2 {
  color: #e8eaf0;
}

html.dark .att-src {
  color: #e8eaf0;
}
</style>
