<template>
  <div class="notes-page">
    <div class="page-header">
      <h2>记事</h2>
      <span class="count">{{ notes.length }} 条</span>
    </div>

    <div v-loading="loading" class="note-list">
      <el-empty v-if="!loading && notes.length === 0" description="暂无记事，点右下角记一条" />

      <div
        v-for="note in notes"
        :key="note.id"
        class="note-card glass"
        @click="goDetail(note)"
      >
        <div class="note-icon" :class="`note-icon-${noteTypeKey(note.noteType)}`">
          <el-icon :size="18"><component :is="typeIcon(note.noteType)" /></el-icon>
        </div>
        <div class="note-body">
          <div class="note-title-row">
            <span class="note-title">{{ note.title || '无标题' }}</span>
            <span class="note-tag" :class="`tag-${noteTypeKey(note.noteType)}`">
              {{ typeLabel(note.noteType) }}
            </span>
          </div>
          <p class="note-preview">{{ preview(note.content) }}</p>
        </div>
        <el-icon class="note-arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <el-button
      class="fab"
      type="primary"
      circle
      @click="$router.push('/notes/new')"
      aria-label="新建记事"
    >
      <el-icon :size="20"><Plus /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Document, Checked, DataLine, ArrowRight, Plus } from '@element-plus/icons-vue';
import { noteApi } from '@/api';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const appStore = useAppStore();

const loading = ref(false);
const notes = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const res: any = await noteApi.list({ accountBookId: appStore.currentBookId });
    notes.value = Array.isArray(res) ? res : res?.items || [];
  } finally {
    loading.value = false;
  }
}

function typeLabel(t?: string) {
  switch (t) {
    case 'TODO': return '待办';
    case 'REPORT': return '报告';
    default: return '笔记';
  }
}

function typeIcon(t?: string) {
  switch (t) {
    case 'TODO': return Checked;
    case 'REPORT': return DataLine;
    default: return Document;
  }
}

function noteTypeKey(t?: string) {
  switch (t) {
    case 'TODO': return 'todo';
    case 'REPORT': return 'report';
    default: return 'note';
  }
}

function preview(content?: string) {
  const text = content || '';
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

function goDetail(note: any) {
  router.push(`/notes/${note.id}`);
}

onMounted(load);
watch(() => appStore.currentBookId, load);
</script>

<style scoped>
.notes-page {
  position: relative;
  padding-bottom: 88px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
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

.note-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-card.glass {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 16px;
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.note-card.glass:hover {
  transform: translateY(-2px);
  background: var(--surface-hover);
  box-shadow: var(--shadow-float);
}

.note-icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #fff;
}

.note-icon-note {
  background: var(--grad-brand);
}

.note-icon-todo {
  background: var(--grad-gold);
}

.note-icon-report {
  background: var(--grad-purple);
}

.note-body {
  flex: 1;
  min-width: 0;
}

.note-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.note-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-tag {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
}

.tag-note {
  color: var(--brand-gold-dark);
  background: var(--brand-gold-soft);
}

.tag-todo {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.tag-report {
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.12);
}

.note-preview {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-arrow {
  color: var(--text-3);
  font-size: 14px;
  flex-shrink: 0;
}

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

.fab:hover {
  box-shadow: 0 10px 30px rgba(20, 184, 166, 0.4);
}

@media (max-width: 767px) {
  .fab {
    right: 18px;
    bottom: calc(74px + env(safe-area-inset-bottom));
  }
}
</style>
