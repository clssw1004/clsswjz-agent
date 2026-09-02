<template>
  <div class="note-form-page">
    <div class="form-card">
      <!-- 顶部导航：返回 + 标题 + 保存胶囊 -->
      <div class="form-nav">
        <button class="nav-back" aria-label="返回" @click="router.back()">
          <el-icon :size="22"><ArrowLeft /></el-icon>
        </button>
        <span class="nav-title">{{ isEdit ? '编辑记事' : '新建记事' }}</span>
        <button class="nav-save" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>

      <!-- 标题输入 -->
      <div class="title-field">
        <input
          v-model="form.title"
          class="title-input"
          type="text"
          placeholder="请输入标题"
          maxlength="100"
        />
      </div>

      <!-- 富文本编辑器（Quill，对齐 gui flutter_quill 的 Delta 格式） -->
      <div class="editor-wrap" v-loading="loading">
        <QuillEditor
          ref="quillEditor"
          class="quill-editor"
          :toolbar="toolbar"
          :placeholder="placeholder"
          theme="snow"
          @ready="onEditorReady"
        />
      </div>

      <!-- 底部面板：分组 / 附件 / 关联（已按需求去掉「作用域」） -->
      <div class="bottom-panel">
        <div class="segmented">
          <button
            v-for="seg in segments"
            :key="seg.key"
            class="seg"
            :class="{ on: activePanel === seg.key }"
            @click="activePanel = seg.key"
          >{{ seg.label }}</button>
        </div>

        <!-- 分组面板 -->
        <div v-if="activePanel === 'group'" class="panel-body">
          <span class="panel-label">选择分组</span>
          <div class="chips">
            <button
              v-for="g in groupOptions"
              :key="g.code"
              class="chip"
              :class="{ on: form.groupCode === g.code }"
              @click="form.groupCode = g.code"
            >{{ g.name }}</button>
          </div>
        </div>

        <!-- 附件面板（对齐 gui _buildAttachmentSection：56 缩略图网格 + 添加 tile） -->
        <div v-else-if="activePanel === 'attachment'" class="panel-body">
          <span class="panel-label">附件</span>
          <div class="attach-grid">
            <div
              v-for="a in displayAttachments"
              :key="a._key"
              class="attach-tile"
              :title="a.originName"
              @click="a._type === 'existing' && openAttachment(a)"
            >
              <div class="attach-thumb">
                <img v-if="a._type === 'new' && a._isImage" :src="a._url" alt="" />
                <el-icon v-else :size="22"><Document /></el-icon>
                <button class="attach-remove" aria-label="移除附件" @click.stop="removeAttachment(a)">
                  <el-icon :size="12"><Close /></el-icon>
                </button>
              </div>
              <span class="attach-name">{{ a.originName }}</span>
            </div>
            <label class="attach-tile attach-add">
              <div class="attach-thumb">
                <el-icon :size="20"><Plus /></el-icon>
              </div>
              <span class="attach-name">添加</span>
              <input type="file" multiple hidden @change="pickAttachments($event)" />
            </label>
          </div>
        </div>

        <!-- 关联账目面板（对齐 gui ItemRelationPanel：3.5px 渐变色条 + 分类/描述 + 金额 + 删除） -->
        <div v-else class="panel-body">
          <div class="rel-header">
            <span class="panel-label">关联账目</span>
            <button class="rel-add-btn" @click="openRelationDialog">
              <el-icon :size="13"><Plus /></el-icon> 关联
            </button>
          </div>

          <div v-if="displayRelations.length" class="rel-list">
            <div v-for="r in displayRelations" :key="r._key" class="rel-card">
              <div class="rel-bar" :style="{ background: relBarBg(r.item) }"></div>
              <div class="rel-main">
                <span class="rel-cat">{{ r.item?.categoryName || '未分类' }}</span>
                <span v-if="r.item?.description" class="rel-desc">{{ r.item.description }}</span>
              </div>
              <span class="rel-amount" :style="{ color: relColor(r.item) }">{{ relAmount(r.item) }}</span>
              <button class="rel-remove" aria-label="移除关联" @click="removeRelation(r)">
                <el-icon :size="14"><Close /></el-icon>
              </button>
            </div>
          </div>
          <div v-else class="panel-empty">暂无关联账目，点击「关联」添加</div>
        </div>
      </div>
    </div>

    <!-- 关联账目选择弹层（对齐 gui _ItemMultiSearchDialog：账本切换 + 关键字搜索 + 多选） -->
    <el-dialog
      v-model="relationDialog"
      title="关联账目"
      width="92%"
      class="rel-dialog"
      :append-to-body="true"
    >
      <div class="rel-dialog-top">
        <el-select v-model="relationBookId" class="rel-book-select" @change="searchRelations">
          <el-option v-for="b in app.books" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
      </div>
      <el-input
        v-model="relationKeyword"
        class="rel-search"
        placeholder="搜索账目"
        clearable
        @input="searchRelations"
        @clear="searchRelations"
      >
        <template #prefix><el-icon :size="14"><Search /></el-icon></template>
      </el-input>

      <div v-loading="relationSearching" class="rel-result-list">
        <div v-if="!relationSearching && relationResults.length === 0" class="panel-empty">无匹配账目</div>
        <div
          v-for="it in relationResults"
          :key="it.id"
          class="rel-result"
          :class="{ sel: relationSelected.has(it.id) }"
          @click="toggleRelationSelect(it)"
        >
          <el-checkbox :model-value="relationSelected.has(it.id)" @click.stop="toggleRelationSelect(it)" />
          <div class="rel-result-main">
            <span class="rel-cat">{{ it.categoryName || '未分类' }}</span>
            <span v-if="it.description" class="rel-desc">{{ it.description }}</span>
          </div>
          <span class="rel-amount" :style="{ color: relColor(it) }">{{ relAmount(it) }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="relationDialog = false">取消</el-button>
        <el-button type="primary" :disabled="relationSelected.size === 0" @click="confirmAddRelations">
          添加{{ relationSelected.size ? `（${relationSelected.size}）` : '' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Close, Document, Plus, Search } from '@element-plus/icons-vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import { noteApi, attachmentApi, itemApi, itemRelationApi } from '@/api';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const router = useRouter();
const app = useAppStore();

const isEdit = computed(() => !!route.params.id);
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  title: '',
  noteType: 'NOTE',
  content: '',
  groupCode: 'none' as string,
});

/** 富文本工具栏：仅加粗 / 斜体 / 下划线 / 勾选列表 / 无序列表，对齐 gui QuillSimpleToolbar */
const toolbar = [
  ['bold', 'italic', 'underline'],
  [{ list: 'check' }, { list: 'bullet' }],
];

const placeholder = '写点什么…';

const segments = [
  { key: 'group', label: '分组' },
  { key: 'attachment', label: '附件' },
  { key: 'relation', label: '关联' },
];

const activePanel = ref<'group' | 'attachment' | 'relation'>('group');

const quillEditor = ref();
let quill: any = null;
let rawContent = '';

function onEditorReady(q: any) {
  quill = q;
  if (rawContent) {
    try {
      // gui 存的是裸 Delta 操作数组（[...]），直接喂给 setContents 即可
      quill.setContents(JSON.parse(rawContent));
    } catch {
      quill.setText(rawContent || '');
    }
  }
}

const groupOptions = ref<{ code: string; name: string }[]>([{ code: 'none', name: '无分组' }]);

/** 分组数据源：后端 noteGroup symbol（对齐 gui SymbolType.noteGroup） */
async function loadGroups() {
  try {
    const res: any = await noteApi.groups();
    const list = Array.isArray(res) ? res : res?.items || [];
    groupOptions.value = [
      { code: 'none', name: '无分组' },
      ...list.map((g: any) => ({ code: g.code, name: g.name })),
    ];
  } catch {
    /* 分组加载失败不阻断编辑 */
  }
}

/* ────────────── 附件（对齐 gui 附件流程：先存 note 拿 id 再传附件） ────────────── */

/** 已落库附件（编辑模式加载） */
const existingAttachments = ref<any[]>([]);
/** 待上传本地文件（新建模式暂存，保存时随 note id 一起上传） */
const newFiles = ref<{ key: string; file: File; url: string }[]>([]);
/** 已标记删除的已落库附件 id（保存时删除） */
const removedIds = ref<string[]>([]);
/** 懒加载下载中的附件 id */
const downloadingIds = reactive(new Set<string>());

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isImage(name: string): boolean {
  return IMAGE_EXTS.includes(extOf(name));
}

/** 合并展示列表：已落库（排除待删除）+ 待上传本地文件 */
const displayAttachments = computed(() => [
  ...existingAttachments.value
    .filter((a) => !removedIds.value.includes(a.id))
    .map((a) => ({ ...a, _key: 'e-' + a.id, _type: 'existing', _isImage: isImage(a.originName), _url: '' })),
  ...newFiles.value.map((f) => ({
    id: '',
    originName: f.file.name,
    fileLength: f.file.size,
    extension: extOf(f.file.name),
    contentType: f.file.type,
    _key: f.key,
    _type: 'new',
    _isImage: isImage(f.file.name),
    _url: f.url,
  })),
]);

async function loadAttachments(noteId: string) {
  try {
    const res: any = await attachmentApi.list({ businessCode: 'note', businessId: noteId });
    existingAttachments.value = Array.isArray(res) ? res : res?.items || [];
  } catch {
    /* 附件加载失败不阻断编辑 */
  }
}

function pickAttachments(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  for (const file of files) {
    newFiles.value.push({
      key: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    });
  }
  input.value = '';
}

function removeAttachment(a: any) {
  if (a._type === 'new') {
    const idx = newFiles.value.findIndex((f) => f.key === a._key);
    if (idx >= 0) {
      URL.revokeObjectURL(newFiles.value[idx].url);
      newFiles.value.splice(idx, 1);
    }
  } else {
    removedIds.value.push(a.id);
  }
}

/** 打开已落库附件（懒加载，对齐 gui downloadAttachment） */
async function openAttachment(a: any) {
  if (downloadingIds.has(a.id)) return;
  downloadingIds.add(a.id);
  try {
    const res = await fetch(`/api/attachments/${a.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('web_token') || ''}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    ElMessage.error('附件加载失败');
  } finally {
    downloadingIds.delete(a.id);
  }
}

async function load() {
  if (!route.params.id) return;
  loading.value = true;
  try {
    const res: any = await noteApi.get(String(route.params.id));
    form.title = res?.title ?? '';
    form.noteType = res?.noteType ?? 'NOTE';
    form.groupCode = res?.groupCode ?? 'none';
    rawContent = res?.content ?? '';
    await loadAttachments(String(route.params.id));
    await loadRelations(String(route.params.id));
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  saving.value = true;
  try {
    // 关键：取裸 Delta 操作数组（.ops），对齐 gui 存储格式；同时写 plainContent 供列表预览
    const ops = quill ? quill.getContents().ops : [];
    const plain = quill ? (quill.getText() as string) : '';
    const data: any = {
      title: form.title.trim(),
      noteType: form.noteType || 'NOTE',
      content: JSON.stringify(ops),
      plainContent: plain,
      groupCode: form.groupCode || 'none',
    };
    let noteId = '';
    if (isEdit.value) {
      noteId = String(route.params.id);
      await noteApi.update(noteId, data);
    } else {
      const created: any = await noteApi.create(data);
      noteId = created?.id || '';
    }
    // 附件：新建先落 note 拿 id 再上传；删除已标记移除的（对齐 gui createNote/updateNote 的 diff 流程）
    await syncAttachments(noteId);
    // 关联账目：新建先落 note 拿 id 再逐条 create；删除已标记移除的
    await syncRelations(noteId);
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功');
    router.back();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

/** 上传新增附件（businessId=noteId）+ 删除已标记移除附件；任一失败不阻断保存（http 拦截器已提示） */
async function syncAttachments(noteId: string) {
  if (!noteId) return;
  const tasks: Promise<any>[] = [];
  for (const f of newFiles.value) tasks.push(attachmentApi.upload(f.file, 'note', noteId));
  for (const id of removedIds.value) tasks.push(attachmentApi.remove(id));
  if (tasks.length) await Promise.allSettled(tasks);
}

/* ────────────── 关联账目（对齐 gui ItemRelationPanel，relationCode='note'） ────────────── */

/** 已落库关联（编辑模式加载）：{ id, itemId, accountBookId, item: {…} } */
const existingRelations = ref<any[]>([]);
/** 待创建的关联（保存时随 note id 一起落库） */
const pendingAdded = ref<any[]>([]);
/** 已标记删除的关联 id（保存时删除） */
const removedRelationIds = ref<string[]>([]);

const displayRelations = computed(() => [
  ...existingRelations.value
    .filter((r) => !removedRelationIds.value.includes(r.id))
    .map((r) => ({ ...r, _key: 'e-' + r.id, _pending: false })),
  ...pendingAdded.value.map((p) => ({ id: '', itemId: p.itemId, item: p.item, _key: 'p-' + p.itemId, _pending: true })),
]);

const relationDialog = ref(false);
const relationBookId = ref('');
const relationKeyword = ref('');
const relationResults = ref<any[]>([]);
const relationSearching = ref(false);
const relationSelected = ref<Set<string>>(new Set());

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** 对齐 gui ColorUtil.getAmountColor：支出红 / 收入绿 / 转账蓝 */
function relColor(item: any): string {
  if (item?.type === 'INCOME') return '#43A047';
  if (item?.type === 'TRANSFER') return '#1B72C1';
  return '#B95B4B';
}

function relBarBg(item: any): string {
  const c = relColor(item);
  return `linear-gradient(180deg, ${c} 0%, ${hexToRgba(c, 0.2)} 100%)`;
}

/** 对齐 gui _buildAccountCard：INCOME 显示 +，其余 -；取绝对值 */
function relAmount(item: any): string {
  if (!item) return '';
  const sign = item.type === 'INCOME' ? '+' : '-';
  const v = Number(item.amount || 0);
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

async function loadRelations(noteId: string) {
  try {
    const res: any = await itemRelationApi.list({ relationCode: 'note', relationId: noteId });
    existingRelations.value = Array.isArray(res) ? res : res?.items || [];
  } catch {
    /* 关联加载失败不阻断编辑 */
  }
}

async function openRelationDialog() {
  if (!app.books.length) await app.loadBooks().catch(() => {});
  relationBookId.value = app.currentBookId || app.books[0]?.id || '';
  relationKeyword.value = '';
  relationSelected.value = new Set();
  relationDialog.value = true;
  await searchRelations();
}

async function searchRelations() {
  if (!relationBookId.value) {
    relationResults.value = [];
    return;
  }
  relationSearching.value = true;
  try {
    const params: any = { accountBookId: relationBookId.value, pageSize: 50 };
    const kw = relationKeyword.value.trim();
    if (kw) params.keyword = kw;
    const res: any = await itemApi.list(params);
    relationResults.value = res?.items || [];
  } finally {
    relationSearching.value = false;
  }
}

function toggleRelationSelect(it: any) {
  const s = new Set(relationSelected.value);
  if (s.has(it.id)) s.delete(it.id);
  else s.add(it.id);
  relationSelected.value = s;
}

function confirmAddRelations() {
  for (const it of relationResults.value) {
    if (!relationSelected.value.has(it.id)) continue;
    const already =
      existingRelations.value.some((r) => r.itemId === it.id && !removedRelationIds.value.includes(r.id)) ||
      pendingAdded.value.some((p) => p.itemId === it.id);
    if (already) continue;
    pendingAdded.value.push({
      itemId: it.id,
      accountBookId: it.accountBookId,
      item: {
        id: it.id,
        type: it.type,
        amount: it.amount,
        description: it.description || '',
        categoryName: it.categoryName || null,
      },
    });
  }
  relationDialog.value = false;
}

function removeRelation(r: any) {
  if (r._pending) {
    pendingAdded.value = pendingAdded.value.filter((p) => p.itemId !== r.itemId);
  } else {
    removedRelationIds.value.push(r.id);
  }
}

/** 保存时同步关联：新建 note 先拿 id 再逐条 create；删除已标记移除的（对齐 gui createRelation/deleteRelation） */
async function syncRelations(noteId: string) {
  if (!noteId) return;
  const tasks: Promise<any>[] = [];
  for (const p of pendingAdded.value) {
    tasks.push(itemRelationApi.create({
      itemId: p.itemId,
      accountBookId: p.accountBookId,
      relationCode: 'note',
      relationId: noteId,
    }));
  }
  for (const id of removedRelationIds.value) tasks.push(itemRelationApi.delete(id));
  if (tasks.length) await Promise.allSettled(tasks);
}

onMounted(() => {
  load();
  loadGroups();
});

onUnmounted(() => {
  for (const f of newFiles.value) URL.revokeObjectURL(f.url);
});
</script>

<style scoped>
.note-form-page {
  max-width: 720px;
  margin: 0 auto;
}

.form-card {
  display: flex;
  flex-direction: column;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  min-height: calc(100vh - 32px);
}

/* 顶部导航 */
.form-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-glass);
}

.nav-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.15s ease;
}

.nav-back:hover {
  background: var(--surface-hover);
}

.nav-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
}

.nav-save {
  border: none;
  padding: 7px 18px;
  border-radius: 999px;
  background: var(--grad-brand);
  color: var(--on-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--glow-primary);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.nav-save:active {
  transform: scale(0.97);
}

.nav-save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 标题输入 */
.title-field {
  padding: 4px 16px;
  border-bottom: 1px solid var(--border-glass);
}

.title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  padding: 14px 0;
  font-family: var(--font-ui);
}

.title-input::placeholder {
  color: var(--text-3);
  font-weight: 400;
}

/* 编辑器 */
.editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quill-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 去掉 snow 主题默认边框，融入卡片 */
.quill-editor :deep(.ql-toolbar) {
  border: none;
  border-bottom: 1px solid var(--border-glass);
  padding: 8px 12px;
}

.quill-editor :deep(.ql-container) {
  border: none;
  font-size: 15px;
  color: var(--text-1);
  font-family: var(--font-ui);
}

.quill-editor :deep(.ql-editor) {
  min-height: 320px;
  line-height: 1.7;
  padding: 16px;
}

.quill-editor :deep(.ql-editor.ql-blank::before) {
  color: var(--text-3);
  font-style: normal;
}

/* 底部面板 */
.bottom-panel {
  border-top: 1px solid var(--border-glass);
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 22px;
  background: var(--bg-deep);
}

.seg {
  flex: 1;
  border: none;
  padding: 9px 0;
  border-radius: 18px;
  background: transparent;
  color: var(--text-3);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.seg.on {
  background: var(--surface-active);
  color: var(--text-1);
  font-weight: 600;
  box-shadow: var(--shadow-card);
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-label {
  font-size: 12px;
  color: var(--text-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid var(--border-glass);
  background: var(--surface-active);
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-1);
  cursor: pointer;
  transition: all 0.18s ease;
}

.chip.on {
  background: var(--brand-gold);
  border-color: transparent;
  color: var(--on-primary);
  font-weight: 600;
}

.panel-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-3);
}

/* 附件网格（对齐 gui 56px 缩略图 + 名称 + 添加 tile） */
.attach-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.attach-tile {
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.attach-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  overflow: hidden;
}

.attach-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attach-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}

.attach-remove:hover {
  background: rgba(0, 0, 0, 0.65);
}

.attach-name {
  width: 64px;
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.attach-add .attach-thumb {
  border: 1px dashed var(--border-glass);
  background: transparent;
  color: var(--text-3);
}

.attach-add:hover .attach-thumb {
  border-color: var(--brand-gold);
  color: var(--brand-gold);
}

/* 关联账目（对齐 gui _buildAccountCard：3.5px 渐变色条 + 分类/描述 + 金额 + 删除） */
.rel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rel-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--brand-gold);
  color: var(--brand-gold);
  background: var(--brand-gold-soft);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.rel-add-btn:active { opacity: 0.8; }

.rel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rel-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
  border-radius: 10px;
  overflow: hidden;
  padding-right: 8px;
}

.rel-bar {
  width: 3.5px;
  align-self: stretch;
  flex-shrink: 0;
}

.rel-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 9px 0;
}

.rel-cat {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rel-desc {
  font-size: 12px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rel-amount {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
  flex-shrink: 0;
}

.rel-remove {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}

.rel-remove:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}

/* 关联弹层 */
.rel-dialog-top {
  margin-bottom: 10px;
}

.rel-book-select {
  width: 100%;
}

.rel-search {
  margin-bottom: 10px;
}

.rel-result-list {
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rel-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-glass);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.rel-result.sel {
  border-color: var(--brand-gold);
  background: var(--brand-gold-soft);
}

.rel-result-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 767px) {
  .note-form-page {
    max-width: 100%;
  }

  .form-card {
    min-height: calc(100vh - 16px);
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}
</style>

<!-- 弹层 teleport 到 body，需全局样式限制桌面端最大宽度 -->
<style>
.rel-dialog.el-dialog {
  max-width: 560px;
}
</style>
