<template>
  <div class="note-form-page">
    <div class="form-card">
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

      <!-- 富文本正文（Quill，对齐 gui flutter_quill 的 Delta 格式；工具栏下沉到底部，正文占满剩余空间） -->
      <div class="editor-wrap" v-loading="loading">
        <QuillEditor
          ref="quillEditor"
          class="quill-editor"
          :content="editorContent"
          content-type="delta"
          :toolbar="false"
          :placeholder="placeholder"
          theme="snow"
          @ready="onEditorReady"
        />
      </div>

      <!-- 底部工具栏（iPhone 备忘录式胶囊：格式 + 分组/附件/关联 + 保存） -->
      <div class="note-toolbar">
        <div class="tool-group">
          <button class="tool-btn" :class="{ on: fmt.bold }" aria-label="加粗" @click="toggleBold"><b>B</b></button>
          <button class="tool-btn" :class="{ on: fmt.italic }" aria-label="斜体" @click="toggleItalic"><i>I</i></button>
          <button class="tool-btn" :class="{ on: fmt.underline }" aria-label="下划线" @click="toggleUnderline"><u>U</u></button>
          <button class="tool-btn" :class="{ on: fmt.list === 'check' }" aria-label="待办清单" @click="toggleCheck">
            <el-icon :size="16"><Select /></el-icon>
          </button>
          <button class="tool-btn" :class="{ on: fmt.list === 'bullet' }" aria-label="无序列表" @click="toggleBullet">
            <el-icon :size="16"><List /></el-icon>
          </button>
        </div>

        <div class="tool-divider"></div>

        <div class="tool-group">
          <button
            class="tool-btn meta"
            :class="{ on: metaSheetOpen && metaSheet === 'group' }"
            aria-label="分组"
            @click="openMeta('group')"
          >
            <el-icon :size="16"><Folder /></el-icon><span class="meta-label">分组</span>
          </button>
          <button
            class="tool-btn meta"
            :class="{ on: metaSheetOpen && metaSheet === 'attachment' }"
            aria-label="附件"
            @click="openMeta('attachment')"
          >
            <el-icon :size="16"><Paperclip /></el-icon><span class="meta-label">附件</span>
            <span v-if="displayAttachments.length" class="tool-badge">{{ displayAttachments.length }}</span>
          </button>
          <button
            class="tool-btn meta"
            :class="{ on: metaSheetOpen && metaSheet === 'relation' }"
            aria-label="关联"
            @click="openMeta('relation')"
          >
            <el-icon :size="16"><Link /></el-icon><span class="meta-label">关联</span>
            <span v-if="displayRelations.length" class="tool-badge">{{ displayRelations.length }}</span>
          </button>
        </div>

        <button class="tool-save" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>

      <!-- 元信息上滑面板（分组 / 附件 / 关联） -->
      <transition name="sheet">
        <div v-if="metaSheetOpen" class="meta-overlay" @click.self="closeMeta">
          <div class="meta-sheet">
            <div class="sheet-grabber"></div>
            <div class="meta-sheet-head">
              <span class="meta-sheet-title">{{ metaSheetTitle }}</span>
              <button class="sheet-close" aria-label="关闭" @click="closeMeta">×</button>
            </div>

            <!-- 分组 -->
            <div v-if="metaSheet === 'group'" class="meta-sheet-body">
              <div class="panel-label-row">
                <span class="panel-label">选择分组</span>
                <button class="panel-manage-btn" @click="openGroupManager">
                  <el-icon :size="13"><Setting /></el-icon> 管理
                </button>
              </div>
              <div class="chips">
                <button
                  v-for="g in groupOptions"
                  :key="g.code"
                  class="chip"
                  :class="{ on: form.groupCode === g.code }"
                  @click="pickGroup(g.code)"
                >{{ g.name }}</button>
              </div>
            </div>

            <!-- 附件 -->
            <div v-else-if="metaSheet === 'attachment'" class="meta-sheet-body">
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

            <!-- 关联 -->
            <div v-else class="meta-sheet-body">
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
      </transition>
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

    <!-- 记事分组管理弹层（新建 / 重命名 / 删除，对齐 gui SymbolCULog.create/update/delete） -->
    <el-dialog
      v-model="groupMgrDialog"
      title="分组管理"
      width="92%"
      class="rel-dialog"
      :append-to-body="true"
    >
      <div class="group-mgr-new">
        <el-input
          v-model="newGroupName"
          class="group-mgr-input"
          placeholder="新建分组名称"
          maxlength="20"
          clearable
          @keydown.enter="submitGroupCreate"
        >
          <template #prefix><el-icon :size="14"><FolderAdd /></el-icon></template>
        </el-input>
        <el-button
          type="primary"
          :disabled="!newGroupName.trim() || groupMgrCreating"
          @click="submitGroupCreate"
        >新建</el-button>
      </div>

      <div v-loading="groupMgrLoading" class="group-mgr-list">
        <div v-if="!groupMgrLoading && groupMgrList.length === 0" class="panel-empty">暂无分组</div>
        <div v-for="g in groupMgrList" :key="g.id" class="group-mgr-row">
          <template v-if="editingGroupId === g.id">
            <el-input
              v-model="editingGroupName"
              class="group-mgr-input"
              maxlength="20"
              @keydown.enter="submitGroupRename(g)"
              @keydown.esc="cancelGroupEdit"
            />
            <el-button type="primary" link :disabled="groupMgrRenaming" @click="submitGroupRename(g)">保存</el-button>
            <el-button link :disabled="groupMgrRenaming" @click="cancelGroupEdit">取消</el-button>
          </template>
          <template v-else>
            <el-icon :size="14" class="group-mgr-icon"><Folder /></el-icon>
            <span class="group-mgr-name">{{ g.name }}</span>
            <span class="group-mgr-code">{{ g.code }}</span>
            <button class="group-mgr-action" aria-label="重命名" @click="startGroupEdit(g)">
              <el-icon :size="14"><Edit /></el-icon>
            </button>
            <button class="group-mgr-action danger" aria-label="删除" @click="removeGroup(g)">
              <el-icon :size="14"><Delete /></el-icon>
            </button>
          </template>
        </div>
      </div>

      <template #footer>
        <el-button @click="groupMgrDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Close, Delete, Document, Edit, Folder, FolderAdd, Link, List, Paperclip, Plus, Search, Select, Setting } from '@element-plus/icons-vue';
import { Delta, loadQuill, QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import { noteApi, attachmentApi, itemApi, itemRelationApi, loadAttachmentUrl } from '@/api';
import { useAppStore } from '@/stores/app';
import { ElMessage, ElMessageBox } from 'element-plus';

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

const placeholder = '写点什么…';

const quillEditor = ref();
let quill: any = null;

/** 底部工具栏格式态（跟随光标 / 文本变化实时刷新） */
const fmt = reactive({ bold: false, italic: false, underline: false, list: '' as string });

function refreshFormat() {
  if (!quill) return;
  try {
    const f = quill.getFormat() || {};
    fmt.bold = !!f.bold;
    fmt.italic = !!f.italic;
    fmt.underline = !!f.underline;
    fmt.list = f.list || '';
  } catch {
    /* 无选区时忽略 */
  }
}

function onEditorReady(q: any) {
  quill = q;
  q.on('selection-change', refreshFormat);
  q.on('text-change', refreshFormat);
}

function toggleBold() { quill?.format('bold', !fmt.bold); }
function toggleItalic() { quill?.format('italic', !fmt.italic); }
function toggleUnderline() { quill?.format('underline', !fmt.underline); }
function toggleCheck() { quill?.format('list', fmt.list === 'check' ? false : 'check'); }
function toggleBullet() { quill?.format('list', fmt.list === 'bullet' ? false : 'bullet'); }

/* ────────────── 元信息上滑面板（分组 / 附件 / 关联） ────────────── */
const metaSheet = ref<'group' | 'attachment' | 'relation'>('group');
const metaSheetOpen = ref(false);

const metaSheetTitle = computed(() =>
  metaSheet.value === 'group' ? '选择分组' : metaSheet.value === 'attachment' ? '附件' : '关联账目',
);

function openMeta(kind: 'group' | 'attachment' | 'relation') {
  if (metaSheetOpen.value && metaSheet.value === kind) {
    metaSheetOpen.value = false;
    return;
  }
  metaSheet.value = kind;
  metaSheetOpen.value = true;
}

function closeMeta() {
  metaSheetOpen.value = false;
}

function pickGroup(code: string) {
  form.groupCode = code;
  metaSheetOpen.value = false;
}

/**
 * 编辑器内容，绑定到 QuillEditor :content，由组件 watch 自动 setContents。
 * 注意：content-type="delta" 时必须传 quill-delta 的 Delta 实例——裸数组会让组件
 * 初始化时 internalModel 变成普通数组（丢失 .diff 方法），异步加载赋值时 watcher
 * 抛 TypeError，组件更新崩溃并卡死路由过渡（表现为「返回不生效」）。
 */
const editorContent = ref<any>(new Delta());

/** gui 存的是裸 Delta 操作数组 JSON（[{"insert":"..."}]）；旧纯文本数据兜底为单段 Delta */
function parseDelta(content?: string | null): any {
  if (!content) return new Delta();
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? new Delta(parsed) : new Delta([{ insert: content }]);
  } catch {
    return new Delta([{ insert: content }]);
  }
}

/**
 * 注册放宽协议白名单的 Image blot。
 * 根因：Quill 2 默认 Image blot 的 sanitize 只放行 http/https/data，blob: URL（本地图片
 * 预览 / 带鉴权 fetch 的 objectURL）会被替换成占位符 "//:0"，正文图片全部裂图。
 * 注意：@vueup/vue-quill 的 Quill 导出是 SSR 懒代理，模块顶层访问会抛错（"Quill is not
 * loaded yet"），必须用 loadQuill() 在浏览器生命周期内取真实构造器；且 Quill 实例共享
 * 默认 registry（DEFAULTS.registry），register 覆盖后对已创建实例实时生效。
 */
let blobImageBlotReady = false;
async function ensureBlobImageBlot() {
  if (blobImageBlotReady) return;
  blobImageBlotReady = true;
  try {
    const Q: any = await loadQuill();
    const ImageBlot: any = Q.import('formats/image');
    class BlobFriendlyImageBlot extends ImageBlot {
      static sanitize(url: string) {
        return typeof url === 'string' && /^(blob:|https?:|data:)/.test(url) ? url : super.sanitize(url);
      }
    }
    Q.register('formats/image', BlobFriendlyImageBlot, true);
  } catch {
    /* 注册失败回退默认 blot：blob 图片显示为裂图，但不阻断编辑 */
  }
}

/* ────────────── 图片嵌入正文（对齐 gui：Delta 存 {'image': attachmentId}） ──────────────
   gui 在选中图片附件时把 {'image': attachment.id} 写进 Quill 正文；web 端对齐该格式：
   - 编辑时 embed 值用 blob: URL 显示（<img> 无法带 Authorization 头直接访问下载端点）；
   - 新建模式尚无 note id，选图时先插 blob URL，保存上传拿到真实 id 后二次回写 content；
   - 加载时把存储的 attachment id 换成带鉴权 fetch 的 objectURL，保存时反向还原。 */
const imgUrlToId = new Map<string, string>();

/** 提取 ops 中所有 image embed 的值 */
function imageValuesOf(ops: any[]): string[] {
  return (ops || [])
    .filter((o) => o?.insert && typeof o.insert === 'object' && o.insert.image)
    .map((o) => o.insert.image as string);
}

/** 加载侧：把存储的 attachment id 替换为可显示的 objectURL（带鉴权 fetch blob） */
async function hydrateImageEmbeds(delta: any): Promise<any> {
  const ids = [...new Set(imageValuesOf(delta?.ops).filter((v) => typeof v === 'string' && !v.startsWith('blob:')))];
  if (!ids.length) return delta;
  await Promise.all(ids.map(async (id) => {
    try {
      const url = await loadAttachmentUrl(id);
      imgUrlToId.set(url, id);
    } catch {
      /* 单张加载失败不阻断：embed 保留原 id 值，保存时原样写回 */
    }
  }));
  const urlById = new Map<string, string>();
  for (const [url, id] of imgUrlToId) urlById.set(id, url);
  const ops = (delta.ops || []).map((o: any) => {
    if (o?.insert && typeof o.insert === 'object' && o.insert.image && urlById.has(o.insert.image)) {
      return { ...o, insert: { image: urlById.get(o.insert.image) } };
    }
    return o;
  });
  return new Delta(ops);
}

/** 保存侧：embed 显示 URL 还原为真实 attachment id；上传失败的本地图片丢弃，已是 id / 外链的保留 */
function toStorageOps(): any[] {
  const ops = quill ? quill.getContents().ops : [];
  const out: any[] = [];
  for (const o of ops) {
    const img = o?.insert && typeof o.insert === 'object' && o.insert.image;
    if (!img) {
      out.push(o);
      continue;
    }
    const v = o.insert.image as string;
    if (typeof v === 'string' && v.startsWith('blob:')) {
      const id = imgUrlToId.get(v);
      if (id) out.push({ ...o, insert: { image: id } });
      // 无 id：上传失败或已从附件面板移除 → 丢弃该 embed
    } else {
      out.push(o);
    }
  }
  return out;
}

/** 往正文末尾追加图片 embed（对齐 gui：\n + image + \n，带 align: 'left'） */
function appendImageEmbed(url: string) {
  if (!quill) return;
  const idx = Math.max(0, quill.getLength() - 1);
  quill.updateContents(
    new Delta().retain(idx).insert('\n').insert({ image: url }, { align: 'left' }).insert('\n'),
  );
}

/** 从正文中移除指定 URL 的图片 embed（附件面板移除时联动） */
function stripImageEmbeds(urls: string[]) {
  if (!quill || !urls.length) return;
  const set = new Set(urls);
  const ops = quill.getContents().ops.filter((o: any) => {
    const img = o?.insert && typeof o.insert === 'object' && o.insert.image;
    return !(img && set.has(o.insert.image));
  });
  quill.setContents(new Delta(ops));
  for (const u of urls) imgUrlToId.delete(u);
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
    groupMgrList.value = list.map((g: any) => ({ id: g.id, code: g.code, name: g.name }));
  } catch {
    /* 分组加载失败不阻断编辑 */
  }
}

/* ────────────── 分组管理（新建 / 重命名 / 删除） ────────────── */

const groupMgrDialog = ref(false);
const groupMgrList = ref<{ id: string; code: string; name: string }[]>([]);
const groupMgrLoading = ref(false);
const newGroupName = ref('');
const groupMgrCreating = ref(false);

const editingGroupId = ref<string>('');
const editingGroupName = ref('');
const groupMgrRenaming = ref(false);

async function openGroupManager() {
  newGroupName.value = '';
  cancelGroupEdit();
  groupMgrDialog.value = true;
  await loadGroups();
}

async function submitGroupCreate() {
  const name = newGroupName.value.trim();
  if (!name) return;
  groupMgrCreating.value = true;
  try {
    await noteApi.groupCreate({ name });
    ElMessage.success('已创建分组');
    newGroupName.value = '';
    await loadGroups();
  } finally {
    groupMgrCreating.value = false;
  }
}

function startGroupEdit(g: any) {
  editingGroupId.value = g.id;
  editingGroupName.value = g.name;
}

function cancelGroupEdit() {
  editingGroupId.value = '';
  editingGroupName.value = '';
}

async function submitGroupRename(g: any) {
  const name = editingGroupName.value.trim();
  if (!name || name === g.name) {
    cancelGroupEdit();
    return;
  }
  groupMgrRenaming.value = true;
  try {
    await noteApi.groupUpdate(g.id, { name });
    ElMessage.success('已重命名');
    cancelGroupEdit();
    await loadGroups();
  } finally {
    groupMgrRenaming.value = false;
  }
}

async function removeGroup(g: any) {
  try {
    await ElMessageBox.confirm(`删除分组「${g.name}」？使用此分组的记事会保留原 groupCode，显示时找不到名称会回退 code。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await noteApi.groupDelete(g.id);
    ElMessage.success('已删除');
    if (form.groupCode === g.code) form.groupCode = 'none';
    await loadGroups();
  } catch {
    ElMessage.error('删除失败');
  }
}

/* ────────────── 附件（对齐 gui 附件流程：先存 note 拿 id 再传附件） ────────────── */

const existingAttachments = ref<any[]>([]);
const newFiles = ref<{ key: string; file: File; url: string }[]>([]);
const removedIds = ref<string[]>([]);
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
    const entry = {
      key: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    };
    newFiles.value.push(entry);
    // 图片附件同时嵌入正文（对齐 gui _handleAddAttachment），保存时替换为真实 attachment id
    if (isImage(file.name)) appendImageEmbed(entry.url);
  }
  input.value = '';
}

function removeAttachment(a: any) {
  if (a._type === 'new') {
    const idx = newFiles.value.findIndex((f) => f.key === a._key);
    if (idx >= 0) {
      const [f] = newFiles.value.splice(idx, 1);
      URL.revokeObjectURL(f.url);
      stripImageEmbeds([f.url]);
    }
  } else {
    removedIds.value.push(a.id);
    // 已落库图片：编辑器里显示的是 objectURL，找到对应映射一并从正文移除
    const urls = [...imgUrlToId.entries()].filter(([, id]) => id === a.id).map(([u]) => u);
    stripImageEmbeds(urls);
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
    editorContent.value = await hydrateImageEmbeds(parseDelta(res?.content));
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
    const plain = quill ? (quill.getText() as string) : '';
    const firstOps = toStorageOps();
    const data: any = {
      title: form.title.trim(),
      noteType: form.noteType || 'NOTE',
      content: JSON.stringify(firstOps),
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
    await syncAttachments(noteId);
    const finalOps = toStorageOps();
    if (JSON.stringify(finalOps) !== JSON.stringify(firstOps)) {
      await noteApi.update(noteId, { ...data, content: JSON.stringify(finalOps) });
    }
    await syncRelations(noteId);
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功');
    router.back();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

/** 上传新增附件（businessId=noteId）+ 删除已标记移除附件；任一失败不阻断保存（http 拦截器已提示）。
    图片附件上传成功后记录 blob URL → attachment id 映射，供 save() 二次回写正文。 */
async function syncAttachments(noteId: string) {
  if (!noteId) return;
  const tasks: Promise<any>[] = [];
  for (const f of newFiles.value) {
    tasks.push(
      attachmentApi
        .upload(f.file, 'note', noteId)
        .then((saved: any) => {
          if (saved?.id && isImage(f.file.name)) imgUrlToId.set(f.url, saved.id);
        })
        .catch(() => {}),
    );
  }
  for (const id of removedIds.value) tasks.push(attachmentApi.remove(id).catch(() => {}));
  if (tasks.length) await Promise.allSettled(tasks);
}

/* ────────────── 关联账目（对齐 gui ItemRelationPanel，relationCode='note'） ────────────── */

const existingRelations = ref<any[]>([]);
const pendingAdded = ref<any[]>([]);
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

/** 对齐 web 设计系统 amount token（收入绿 --amount-income / 支出红 --amount-expense），方向与 gui ColorUtil 一致 */
function relColor(item: any): string {
  if (item?.type === 'INCOME') return '#2BA370';
  if (item?.type === 'TRANSFER') return '#1B72C1';
  return '#F2573D';
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

onMounted(async () => {
  await ensureBlobImageBlot();
  load();
  loadGroups();
});

onUnmounted(() => {
  for (const f of newFiles.value) URL.revokeObjectURL(f.url);
  for (const url of imgUrlToId.keys()) URL.revokeObjectURL(url);
  imgUrlToId.clear();
});
</script>

<style scoped>
.note-form-page {
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
}

.form-card {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* 标题输入 */
.title-field {
  padding: 12px 16px 6px;
  flex-shrink: 0;
}

.title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 19px;
  font-weight: 600;
  color: var(--text-1);
  padding: 8px 0;
  font-family: var(--font-ui);
}

.title-input::placeholder {
  color: var(--text-3);
  font-weight: 400;
}

/* 富文本正文：占满剩余空间、内部滚动（工具栏已下沉到底部）。
   关键点：@vueup/vue-quill 的 render 返回 Vue Fragment，class="quill-editor" 在 DOM 里不是
   真实节点，以它作为祖先的 :deep() 规则会全部失效，须以 ql-container / ql-editor 为起点。 */
.editor-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-wrap :deep(.ql-container) {
  border: none;
  font-size: 15px;
  color: var(--text-1);
  font-family: var(--font-ui);
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-wrap :deep(.ql-editor) {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  line-height: 1.7;
  padding: 16px;
}

.editor-wrap :deep(.ql-editor.ql-blank::before) {
  color: var(--text-3);
  font-style: normal;
}

/* 正文内嵌图片（对齐 gui QuillEditorImageEmbedConfig 的展示效果） */
.editor-wrap :deep(.ql-editor img) {
  max-width: 100%;
  border-radius: 8px;
  display: block;
  margin: 6px 0;
}

/* 底部工具栏（胶囊式，超宽时可横向滚动，保存按钮吸右侧） */
.note-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-glass);
  overflow-x: auto;
  scrollbar-width: none;
}

.note-toolbar::-webkit-scrollbar {
  display: none;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tool-btn {
  height: 34px;
  min-width: 34px;
  padding: 0 8px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.tool-btn b { font-weight: 700; }
.tool-btn i { font-style: italic; }
.tool-btn u { text-decoration: underline; }

.tool-btn.on {
  background: var(--brand-gold-soft);
  color: var(--brand-gold);
}

.tool-btn.meta {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-deep);
  color: var(--text-2);
}

.tool-btn.meta.on {
  background: var(--brand-gold-soft);
  color: var(--brand-gold);
}

.tool-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--brand-gold);
  color: var(--on-primary);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tool-divider {
  width: 1px;
  height: 22px;
  background: var(--border-glass-strong);
  flex-shrink: 0;
  margin: 0 2px;
}

.tool-save {
  margin-left: auto;
  position: sticky;
  right: 0;
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: var(--grad-brand);
  color: var(--on-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--glow-primary);
  flex-shrink: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tool-save:active { transform: scale(0.97); }
.tool-save:disabled { opacity: 0.55; cursor: not-allowed; }

/* 元信息上滑面板 */
.meta-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(2px);
}

.meta-sheet {
  width: 100%;
  max-height: 72%;
  overflow-y: auto;
  background: var(--surface-glass);
  border-top: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.16);
  padding: 0 20px calc(20px + env(safe-area-inset-bottom));
}

.sheet-grabber {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-glass-strong);
  margin: 8px auto 12px;
}

.meta-sheet-head {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

.meta-sheet-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.sheet-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--bg-deep);
  color: var(--text-3);
  font-size: 16px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.meta-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 上滑过渡 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .meta-sheet,
.sheet-leave-active .meta-sheet {
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .meta-sheet,
.sheet-leave-to .meta-sheet {
  transform: translateY(100%);
}

/* 分组 chips */
.panel-label {
  font-size: 12px;
  color: var(--text-3);
}

.panel-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-manage-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border-glass);
  background: var(--surface-active);
  color: var(--text-2);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.panel-manage-btn:hover {
  border-color: var(--brand-gold);
  color: var(--brand-gold);
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

/* ── 分组管理弹层 ── */
.group-mgr-new {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.group-mgr-input {
  flex: 1;
}

.group-mgr-list {
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-mgr-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--surface-active);
  border: 1px solid var(--border-glass);
  min-height: 42px;
}

.group-mgr-icon {
  color: var(--brand-gold);
  flex-shrink: 0;
}

.group-mgr-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-mgr-code {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--font-mono);
  background: var(--bg-deep);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.group-mgr-action {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.group-mgr-action:hover {
  background: var(--surface-hover);
  color: var(--text-1);
}

.group-mgr-action.danger:hover {
  background: rgba(242, 87, 61, 0.12);
  color: var(--amount-expense);
}

@media (max-width: 767px) {
  .note-form-page {
    max-width: 100%;
  }

  .form-card {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .title-field {
    padding-top: 6px;
  }

  /* 移动端收紧工具栏间距，确保 390 视口下 5 格式 + 3 元信息 + 保存胶囊单行不溢出
     （实测未收紧时 scrollWidth=407 > clientWidth=390，17px 横向溢出） */
  .note-toolbar {
    gap: 4px;
    padding: 10px 8px calc(10px + env(safe-area-inset-bottom));
  }

  .tool-group {
    gap: 3px;
  }

  .tool-btn {
    min-width: 30px;
    height: 32px;
    padding: 0 6px;
  }

  /* 移动端收起 meta 文字，仅图标 + 角标，保证工具栏单行不溢出 */
  .tool-btn.meta {
    padding: 0 8px;
  }

  .tool-btn.meta .meta-label {
    display: none;
  }

  .tool-save {
    padding: 0 12px;
    height: 32px;
  }

  .tool-divider {
    margin: 0 1px;
  }
}
</style>

<!-- 弹层 teleport 到 body，需全局样式限制桌面端最大宽度 -->
<style>
.rel-dialog.el-dialog {
  max-width: 560px;
}
</style>
