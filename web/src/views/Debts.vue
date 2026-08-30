<template>
  <div class="db">
    <!-- 计数行（对齐原型 Nav Bar「3 笔」） -->
    <div class="db-count-row">{{ total }} 笔</div>

    <!-- ===== 债务列表（对齐设计稿 Debt Card） ===== -->
    <div v-loading="loading" class="db-list">
      <el-empty v-if="!loading && !list.length" description="暂无债务" :image-size="60" />

      <div v-for="d in list" :key="d.id" class="db-card" @click="router.push(`/debts/${d.id}`)">
        <!-- 主行 -->
        <div class="db-main">
          <!-- 类型胶囊：借出 ↑ 红 / 借入 ↓ 绿 -->
          <span class="db-type" :class="d.debtType === 'LEND' ? 'lend' : 'borrow'">
            <el-icon :size="13"><component :is="d.debtType === 'LEND' ? Top : Bottom" /></el-icon>
            {{ d.debtType === 'LEND' ? '借出' : '借入' }}
          </span>

          <!-- 债务人 + 日期 -->
          <div class="db-info">
            <span class="db-debtor">{{ d.debtor }}</span>
            <span class="db-date">
              <el-icon :size="11"><Calendar /></el-icon>
              {{ d.debtDate || '—' }}
            </span>
          </div>

          <!-- 右侧：已结清 / 剩余金额 -->
          <div v-if="isCleared(d)" class="db-cleared">
            <el-icon :size="13"><CircleCheck /></el-icon>
            已结清
          </div>
          <div v-else class="db-remain">
            <span class="db-remain-label">{{ d.debtType === 'LEND' ? '待收' : '待还' }}</span>
            <span class="db-remain-num">{{ fmtAmount(d.remainAmount) }}</span>
          </div>
        </div>

        <!-- 进度条：已还/总额 -->
        <div class="db-progress-row">
          <div class="db-progress">
            <div class="db-progress-bar" :style="{ width: progress(d) }"></div>
          </div>
          <span class="db-total">{{ fmtAmount(d.amount) }}</span>
        </div>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="loadingMore" class="db-more">
      <el-icon class="is-loading" :size="15"><Loading /></el-icon>
      <span>加载中…</span>
    </div>

    <!-- 右下 FAB（对齐设计稿） -->
    <button class="db-fab" title="新增债务" @click="router.push('/debts/new')">
      <el-icon :size="24"><Plus /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Top, Bottom, Calendar, CircleCheck, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { debtApi } from '@/api';

const router = useRouter();
const PAGE = 50;
const list = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const offset = ref(0);

function isCleared(d: any) {
  return d.clearState === 'cleared' || Number(d.remainAmount) <= 0;
}

function progress(d: any) {
  const amount = Number(d.amount) || 0;
  if (amount <= 0) return '0%';
  const paid = amount - Number(d.remainAmount ?? amount);
  return `${Math.min(100, Math.max(0, (paid / amount) * 100)).toFixed(1)}%`;
}

function fmtAmount(v?: number | string) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? '-');
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function load() {
  if (loading.value || loadingMore.value) return;
  if (offset.value === 0) loading.value = true;
  else loadingMore.value = true;
  try {
    const res: any = await debtApi.list({ limit: PAGE, offset: offset.value });
    const items = Array.isArray(res) ? res : res?.items || [];
    total.value = Array.isArray(res) ? items.length : (res?.total ?? items.length);
    list.value = offset.value === 0 ? items : [...list.value, ...items];
    hasMore.value = items.length === PAGE;
    offset.value += items.length;
  } catch (e: any) {
    ElMessage.error(e?.message || '加载债务失败');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function onScroll() {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140) {
    load();
  }
}

onMounted(() => {
  load();
  window.addEventListener('scroll', onScroll);
});
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<style scoped>
.db {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 0 90px;
  position: relative;
}

/* 计数 */
.db-count-row {
  margin: 4px 16px 0;
  font-size: 12px;
  color: #8a8f99;
}

/* ===== 列表 ===== */
.db-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

.db-card {
  margin: 0 12px;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(230, 233, 240, 0.9);
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.db-card:hover {
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.08);
}

.db-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 类型胶囊 */
.db-type {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 9px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.db-type.lend {
  color: #f2573d;
  background: rgba(242, 87, 61, 0.12);
}

.db-type.borrow {
  color: #2ba370;
  background: rgba(43, 163, 112, 0.12);
}

.db-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.db-debtor {
  font-size: 15px;
  font-weight: 600;
  color: #1a1c26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.db-date {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #8a8f99;
}

.db-remain {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.db-remain-label {
  font-size: 10px;
  color: #8a8f99;
  font-weight: 500;
}

.db-remain-num {
  font-size: 18px;
  font-weight: 700;
  color: #2e6be5;
  letter-spacing: -0.3px;
  white-space: nowrap;
}

.db-cleared {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #2ba370;
  background: rgba(43, 163, 112, 0.1);
  border: 1px solid rgba(43, 163, 112, 0.3);
}

/* 进度条 */
.db-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.db-progress {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.db-progress-bar {
  height: 100%;
  border-radius: 2px;
  background: rgba(46, 107, 229, 0.6);
  transition: width 0.3s ease;
}

.db-total {
  font-size: 10px;
  color: #b0b5c0;
  white-space: nowrap;
}

/* 加载更多 */
.db-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0 4px;
  font-size: 12px;
  color: #8a8f99;
}

/* FAB */
.db-fab {
  position: fixed;
  right: max(20px, calc((100vw - 480px) / 2 + 20px));
  bottom: 24px;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a8cf7, #2e6be6);
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(46, 107, 229, 0.35);
  z-index: 20;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.db-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(46, 107, 229, 0.45);
}

/* 暗色 */
html.dark .db-card {
  background: #1e2130;
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .db-debtor {
  color: #e8eaf0;
}

html.dark .db-progress {
  background: rgba(255, 255, 255, 0.1);
}

html.dark .db-count-row {
  color: #9ca1ad;
}
</style>
