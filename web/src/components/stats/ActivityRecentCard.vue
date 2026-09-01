<template>
  <div v-if="rows.length" class="recent-card">
    <div class="rc-head">
      <el-icon :size="17" class="rc-icon"><Trophy /></el-icon>
      <span class="rc-title">最近打卡</span>
      <span class="rc-more" @click="router.push('/activities')">
        查看全部<el-icon :size="13"><ArrowRight /></el-icon>
      </span>
    </div>
    <div class="rc-body">
      <div v-for="r in rows" :key="r.def.id" class="rc-row">
        <span class="rc-emoji">{{ r.def.emoji }}</span>
        <span class="rc-name">{{ r.def.name }}</span>
        <span class="rc-count" :style="{ color: hex(r.def.color), background: hexSoft(r.def.color) }">
          ×{{ r.count }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 最近打卡 —— 对齐 Ardot 原型「05-最近打卡」/ gui ActivityRecentRecords。
 * 仅展示"今天"有打卡记录的活动；无数据时整卡不渲染（对齐 gui 空态返回 SizedBox.shrink）。
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Trophy, ArrowRight } from '@element-plus/icons-vue';
import { activityDefApi, activityRecordApi } from '@/api';
import { useAppStore } from '@/stores/app';

const router = useRouter();
const app = useAppStore();

const defs = ref<any[]>([]);
const records = ref<any[]>([]);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 今天有打卡记录的活动行（按定义 sortOrder 排序） */
const rows = computed(() => {
  const today = todayStr();
  const countOf = (defId: string) =>
    records.value.filter(
      (r) => r.activityDefId === defId && String(r.recordDate || '').slice(0, 10) === today
    ).length;
  return defs.value
    .filter((d) => countOf(d.id) > 0)
    .map((d) => ({ def: d, count: countOf(d.id) }));
});

/** 颜色 int(0xRRGGBB) → hex（对齐 gui Color(def.color)） */
function hex(c: number) {
  const h = (Number(c) >>> 0).toString(16).padStart(6, '0');
  return '#' + h;
}

function hexSoft(c: number) {
  return `color-mix(in srgb, ${hex(c)} 12%, transparent)`;
}

async function load() {
  if (!app.currentBookId) return;
  try {
    const [d, r]: any = await Promise.all([
      activityDefApi.list({ accountBookId: app.currentBookId }),
      activityRecordApi.list({ accountBookId: app.currentBookId }),
    ]);
    defs.value = Array.isArray(d) ? d : [];
    records.value = Array.isArray(r) ? r : [];
  } catch {
    defs.value = [];
    records.value = [];
  }
}

onMounted(load);
watch(() => app.currentBookId, load);
</script>

<style scoped>
/* 独立卡片容器：surfaceContainerHighest 80 底 + 16 圆角 + 0.5 描边（对齐原型/ gui） */
.recent-card {
  background: rgba(15, 23, 42, 0.035);
  border: 0.5px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 14px 16px 10px;
}

html.dark .recent-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.09);
}

.rc-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

.rc-icon {
  color: var(--brand-gold);
}

.rc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--brand-gold);
  flex: 1;
}

.rc-more {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 12px;
  color: var(--brand-gold);
  cursor: pointer;
  padding: 3px 2px;
  border-radius: 6px;
  white-space: nowrap;
}

.rc-more:hover {
  opacity: 0.85;
}

.rc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.rc-emoji {
  font-size: 21px;
  line-height: 1;
}

.rc-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rc-count {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
}
</style>
