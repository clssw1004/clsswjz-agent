<template>
  <div class="notes-page">
    <div class="page-header">
      <h2>记事</h2>
      <span class="count">{{ notes.length }} 条</span>
    </div>

    <div v-loading="loading" class="note-list">
      <el-empty v-if="!loading && notes.length === 0" description="暂无记事" />

      <el-card
        v-for="note in notes"
        :key="note.id"
        class="note-card glass"
        shadow="hover"
        @click="goDetail(note)"
      >
        <div class="note-card-body">
          <div class="note-title-row">
            <span class="note-title">{{ note.title || '无标题' }}</span>
            <el-tag :type="typeTag(note.noteType)" size="small" effect="light">
              {{ typeLabel(note.noteType) }}
            </el-tag>
          </div>
          <p class="note-preview">{{ preview(note.content) }}</p>
        </div>
      </el-card>
    </div>

    <el-button class="fab" type="primary" icon="Plus" circle @click="$router.push('/notes/new')" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
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

function typeTag(t?: string) {
  switch (t) {
    case 'TODO': return 'warning' as const;
    case 'REPORT': return 'success' as const;
    default: return '' as const;
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
</script>

<style scoped>
.notes-page {
  position: relative;
  padding-bottom: 80px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
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
  box-shadow: var(--shadow-pop);
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

.note-preview {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  word-break: break-word;
}

.fab {
  position: fixed;
  right: 32px;
  bottom: 48px;
  width: 52px;
  height: 52px;
  font-size: 22px;
  box-shadow: var(--shadow-glow-gold);
}
</style>
