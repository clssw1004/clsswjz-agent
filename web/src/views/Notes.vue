<template>
  <div class="notes-page">
    <div class="notes-inner">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-icon :size="16" class="search-icon"><Search /></el-icon>
        <input
          v-model="searchText"
          class="search-input"
          type="text"
          placeholder="搜索记事"
        />
      </div>

      <!-- 分组筛选（对齐 GUI NoteGroupFilter） -->
      <div v-if="groups.length" class="group-filter">
        <button class="group-chip" :class="{ on: activeGroup === '' }" @click="activeGroup = ''">全部</button>
        <button
          v-for="g in groups"
          :key="g"
          class="group-chip"
          :class="{ on: activeGroup === g }"
          @click="activeGroup = g"
        >{{ g }}</button>
      </div>

      <!-- 列表 -->
      <div v-loading="loading" class="note-list">
        <el-empty v-if="!loading && filtered.length === 0" description="暂无记事，点右下角记一条" />

        <div
          v-for="note in filtered"
          :key="note.id"
          class="note-card"
          @click="goDetail(note)"
        >
          <!-- 左侧彩色装饰条（对齐 gui：accent → 40% 透明渐变） -->
          <div
            class="color-bar"
            :style="{ background: `linear-gradient(180deg, ${accentOf(note)} 0%, ${hexToRgba(accentOf(note), 0.4)} 100%)` }"
          ></div>

          <div class="note-body">
            <!-- 标题行 -->
            <div class="title-row">
              <el-icon :size="18" class="subject-icon" :style="{ color: accentOf(note) }"><Memo /></el-icon>
              <span class="note-title">{{ note.title || '无标题' }}</span>
              <span
                v-if="note.groupCode"
                class="group-tag"
                :style="{ color: accentOf(note), background: hexToRgba(accentOf(note), 0.12) }"
              >{{ note.groupCode }}</span>
              <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, note)" @click.stop>
                <el-icon class="note-more" :size="18"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- 纯文本预览（优先 plainContent，兜底解析 Delta） -->
            <p class="note-preview" :class="{ expanded: expandedId === note.id }">{{ preview(note) }}</p>

            <!-- 底部：时间 + 展开箭头 -->
            <div class="note-bottom">
              <el-icon :size="14" class="time-icon"><Clock /></el-icon>
              <span class="note-time">{{ formatTime(note.createdAt) }}</span>
              <span class="spacer"></span>
              <el-icon
                :size="20"
                class="expand-icon"
                :class="{ rotated: expandedId === note.id }"
                @click.stop="toggleExpand(note.id)"
              ><ArrowDown /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-button class="fab" type="primary" circle @click="$router.push('/notes/new')" aria-label="新建记事">
      <el-icon :size="20"><Plus /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Search, MoreFilled, Memo, Clock, ArrowDown } from '@element-plus/icons-vue';
import { noteApi } from '@/api';

const router = useRouter();

const loading = ref(false);
const notes = ref<any[]>([]);
const searchText = ref('');
const activeGroup = ref('');
const expandedId = ref<string | null>(null);

/** gui note_tile 的 10 色调色板（_notePalette） */
const NOTE_PALETTE = [
  '#5C6BC0', // indigo
  '#26A69A', // teal
  '#FF7043', // deep orange
  '#AB47BC', // purple
  '#42A5F5', // blue
  '#66BB6A', // green
  '#EC407A', // pink
  '#FFA726', // orange
  '#26C6DA', // cyan
  '#8D6E63', // brown
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** 对齐 gui：accent 色 = (groupCode ?? id) 哈希后取模选色 */
function accentOf(note: any): string {
  const key = note.groupCode || note.id || '';
  return NOTE_PALETTE[hashString(key) % NOTE_PALETTE.length];
}

const groups = computed(() => {
  const set = new Set<string>();
  for (const n of notes.value) {
    if (n.groupCode) set.add(n.groupCode);
  }
  return Array.from(set).sort();
});

const filtered = computed(() => {
  let list = notes.value;
  if (activeGroup.value) {
    list = list.filter((n) => n.groupCode === activeGroup.value);
  }
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase();
    list = list.filter((n) =>
      (n.title || '').toLowerCase().includes(q) ||
      (preview(n) || '').toLowerCase().includes(q)
    );
  }
  return list;
});

/** 预览：优先 plainContent，兜底解析 Delta（兼容旧纯文本数据） */
function preview(note: any): string {
  if (note.plainContent) return note.plainContent;
  return deltaToPlain(note.content);
}

function deltaToPlain(content?: string): string {
  if (!content) return '';
  try {
    const ops = JSON.parse(content);
    if (Array.isArray(ops)) {
      return ops
        .map((op: any) => (typeof op?.insert === 'string' ? op.insert : ''))
        .join('');
    }
    return content;
  } catch {
    return content;
  }
}

function formatTime(ts?: number | string): string {
  if (!ts) return '';
  const t = typeof ts === 'string' ? Number(ts) : ts;
  if (!t || Number.isNaN(t)) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now.getTime() - t;
  const day = 86400000;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (diff < day && now.getDate() === d.getDate()) return `今天 ${hh}:${mm}`;
  if (diff < 2 * day) return `昨天 ${hh}:${mm}`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function load() {
  loading.value = true;
  try {
    // 记事已提为全局数据：不再按账本（accountBookId）筛选
    const res: any = await noteApi.list();
    notes.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

async function deleteNote(note: any) {
  try {
    await noteApi.delete(note.id);
    notes.value = notes.value.filter((n) => n.id !== note.id);
    ElMessage.success('已删除');
  } catch {
    ElMessage.error('删除失败');
  }
}

function handleCommand(cmd: string, note: any) {
  if (cmd === 'edit') {
    router.push(`/notes/${note.id}`);
  } else if (cmd === 'delete') {
    ElMessageBox.confirm('确定删除这条记事？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => deleteNote(note)).catch(() => {});
  }
}

function goDetail(note: any) {
  router.push(`/notes/${note.id}`);
}

onMounted(load);
</script>

<style scoped>
.notes-page {
  position: relative;
  padding-bottom: 88px;
}

.notes-inner {
  max-width: 720px;
  margin: 0 auto;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  border-radius: 999px;
  padding: 10px 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.search-icon {
  color: var(--text-3);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-ui);
}

.search-input::placeholder {
  color: var(--text-3);
}

/* 分组筛选 */
.group-filter {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 10px;
  -webkit-overflow-scrolling: touch;
}

.group-filter::-webkit-scrollbar { display: none; }

.group-filter .group-chip {
  flex-shrink: 0;
  border: 1px solid var(--border-glass);
  background: var(--surface-glass);
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.group-filter .group-chip.on {
  background: var(--brand-gold);
  color: var(--on-primary);
  border-color: transparent;
  font-weight: 600;
}

/* 列表 */
.note-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-card {
  display: flex;
  align-items: stretch;
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.18s ease;
}

.note-card:hover {
  transform: translateY(-2px);
}

.color-bar {
  width: 4px;
  flex-shrink: 0;
}

.note-body {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.subject-icon {
  flex-shrink: 0;
}

.note-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-tag {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.note-more {
  flex-shrink: 0;
  color: var(--text-3);
  padding: 4px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.note-more:hover {
  background: var(--surface-hover);
}

.note-preview {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  word-break: break-word;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-preview.expanded {
  display: block;
  -webkit-line-clamp: unset;
  overflow: visible;
}

.note-bottom {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.time-icon {
  color: var(--text-3);
}

.note-time {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
  letter-spacing: 0.3px;
}

.spacer {
  flex: 1;
}

.expand-icon {
  color: var(--text-3);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: transform 0.2s ease, background 0.15s ease;
}

.expand-icon:hover {
  background: var(--surface-hover);
}

.expand-icon.rotated {
  transform: rotate(180deg);
}

/* FAB */
.fab {
  position: fixed;
  right: 28px;
  bottom: 32px;
  width: 56px;
  height: 56px;
  font-size: 22px;
  border: none;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
}

.fab:hover { box-shadow: 0 10px 30px rgba(46, 107, 229, 0.4); }

@media (max-width: 767px) {
  .fab {
    right: 18px;
    bottom: calc(74px + env(safe-area-inset-bottom));
  }
}
</style>
