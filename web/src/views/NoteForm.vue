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

        <!-- 附件面板（后续版本支持） -->
        <div v-else-if="activePanel === 'attachment'" class="panel-body">
          <div class="panel-empty">附件功能后续版本支持</div>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import { noteApi } from '@/api';

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

async function load() {
  if (!route.params.id) return;
  loading.value = true;
  try {
    const res: any = await noteApi.get(String(route.params.id));
    form.title = res?.title ?? '';
    form.noteType = res?.noteType ?? 'NOTE';
    form.groupCode = res?.groupCode ?? 'none';
    rawContent = res?.content ?? '';
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
    if (isEdit.value) {
      await noteApi.update(String(route.params.id), data);
      ElMessage.success('保存成功');
    } else {
      await noteApi.create(data);
      ElMessage.success('创建成功');
    }
    router.back();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  load();
  loadGroups();
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
