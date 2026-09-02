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

        <!-- 关联面板（后续版本支持） -->
        <div v-else class="panel-body">
          <div class="panel-empty">关联账目功能后续版本支持</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Close, Document, Plus } from '@element-plus/icons-vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import { noteApi, attachmentApi } from '@/api';

const route = useRoute();
const router = useRouter();

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
