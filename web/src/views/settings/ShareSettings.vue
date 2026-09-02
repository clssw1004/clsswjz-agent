<template>
  <div class="share-page">
    <Panel noPad>
      <div class="page-head">
        <button class="back-btn" @click="router.back()"><el-icon><ArrowLeft /></el-icon></button>
        <span class="page-title">数据共享</span>
        <button class="add-btn" @click="openUserPicker"><el-icon><Plus /></el-icon>添加</button>
      </div>
    </Panel>

    <div v-loading="loading" class="list-body">
      <el-empty v-if="!loading && !users.length" description="还没有共享对象">
        <el-button type="primary" @click="openUserPicker">添加共享用户</el-button>
        <p class="empty-hint">可从同账本成员中选择，把车辆/加油/债务/活动/经期等模块共享给 TA 查看</p>
      </el-empty>

      <Panel v-for="user in users" :key="user.userId" divider noPad class="user-card">
        <template #head>
          <div class="user-head">
            <div class="avatar">{{ (user.nickname || 'U').slice(0, 1).toUpperCase() }}</div>
            <span class="nick">{{ user.nickname }}</span>
            <button class="remove-btn" title="移除" @click="confirmRemove(user)">
              <el-icon :size="15"><Delete /></el-icon>
            </button>
          </div>
        </template>

        <div v-for="m in MODULES" :key="m.type" class="module-row" @click="toggle(user, m)">
          <div class="mod-icon" :style="{ background: m.bg }">
            <span>{{ m.emoji }}</span>
          </div>
          <span class="mod-label">{{ m.label }}</span>
          <el-switch
            :model-value="isShared(user, m.type)"
            size="small"
            @click.stop
            @change="(v: any) => toggle(user, m, Boolean(v))"
          />
        </div>
      </Panel>
    </div>

    <!-- 添加用户弹层 -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="pickerVisible" class="sheet-mask" @click.self="pickerVisible = false">
          <div class="sheet picker-sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">添加用户</div>
            <el-input
              v-model="searchQuery"
              placeholder="搜索昵称"
              :prefix-icon="Search"
              clearable
              class="picker-search"
            />
            <div class="picker-list">
              <div v-if="!filteredCandidates.length" class="picker-empty">没有可选用户（需为同账本成员）</div>
              <div
                v-for="u in filteredCandidates"
                :key="u.id"
                class="picker-item"
                @click="addUser(u)"
              >
                <div class="avatar sm">{{ (u.nickname || 'U').slice(0, 1).toUpperCase() }}</div>
                <span>{{ u.nickname }}</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Plus, Delete, Search } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { userShareApi, userApi } from '@/api';
import Panel from '@/components/Panel.vue';

const router = useRouter();

/** 可共享模块（对齐 GUI share_settings_page _modules；periodCycle 联动 periodDailyRecord 由后端处理） */
const MODULES = [
  { type: 'vehicle', label: '车辆', emoji: '🚗', bg: 'linear-gradient(135deg, #38bdf8, #0ea5e9)' },
  { type: 'fuelRecord', label: '加油记录', emoji: '⛽', bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
  { type: 'debt', label: '债务', emoji: '💰', bg: 'linear-gradient(135deg, #34d399, #10b981)' },
  { type: 'activity', label: '活动打卡', emoji: '🏅', bg: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' },
  { type: 'periodCycle', label: '经期记录', emoji: '🌸', bg: 'linear-gradient(135deg, #f472b6, #ec4899)' },
];

const loading = ref(false);
const users = ref<{ userId: string; nickname: string }[]>([]);
const myShares = ref<any[]>([]);
const candidates = ref<{ id: string; nickname: string }[]>([]);
const pickerVisible = ref(false);
const searchQuery = ref('');

const filteredCandidates = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const existing = new Set(users.value.map((u) => u.userId));
  return candidates.value
    .filter((c) => !existing.has(c.id))
    .filter((c) => !q || c.nickname.toLowerCase().includes(q));
});

function isShared(user: { userId: string }, type: string) {
  return myShares.value.some((s) => s.targetUserId === user.userId && s.businessType === type && s.isEnabled);
}

async function loadData() {
  loading.value = true;
  try {
    const [listRes, eligRes]: any = await Promise.all([
      userShareApi.list(),
      userShareApi.eligibleUsers(),
    ]);
    const data = listRes?.data ?? listRes ?? {};
    myShares.value = Array.isArray(data.myShares) ? data.myShares : [];
    candidates.value = Array.isArray(eligRes) ? eligRes : eligRes?.items || [];

    // 从共享配置聚合目标用户（去重），昵称优先用通用接口解析（含非当前账本成员的历史共享对象）
    const targetIds = [...new Set(myShares.value.map((s) => s.targetUserId))];
    let nameMap: Record<string, string> = {};
    if (targetIds.length) {
      try {
        const res: any = await userApi.nicknames(targetIds);
        if (res && typeof res === 'object') nameMap = res;
      } catch { /* 回退 candidates/占位 */ }
    }
    const byId = new Map<string, string>();
    for (const id of targetIds) {
      byId.set(
        id,
        nameMap[id] || candidates.value.find((x) => x.id === id)?.nickname || `用户 ${id.slice(-4)}`,
      );
    }
    users.value = [...byId.entries()].map(([userId, nickname]) => ({ userId, nickname }));
  } finally {
    loading.value = false;
  }
}

function openUserPicker() {
  searchQuery.value = '';
  pickerVisible.value = true;
}

async function addUser(u: { id: string; nickname: string }) {
  users.value.push({ userId: u.id, nickname: u.nickname });
  pickerVisible.value = false;
}

async function toggle(user: { userId: string }, m: { type: string }, force?: boolean) {
  const cur = isShared(user, m.type);
  const next = force === undefined ? !cur : force;
  if (next === cur) return;
  // 乐观更新
  if (next) {
    myShares.value.push({ targetUserId: user.userId, businessType: m.type, isEnabled: true });
  } else {
    myShares.value = myShares.value.filter(
      (s) => !(s.targetUserId === user.userId && s.businessType === m.type),
    );
  }
  try {
    await userShareApi.setShare({ targetUserId: user.userId, businessType: m.type, isEnabled: next });
  } catch {
    await loadData(); // 失败回滚
  }
}

async function confirmRemove(user: { userId: string; nickname: string }) {
  const ok = await ElMessageBox.confirm(
    `移除后将关闭对「${user.nickname}」的全部模块共享，确定吗？`, '移除用户',
    { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' },
  ).catch(() => false);
  if (!ok) return;
  await userShareApi.removeTarget(user.userId);
  ElMessage.success('已移除');
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
.share-page {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.page-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.back-btn,
.add-btn {
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.back-btn:hover,
.add-btn:hover {
  background: var(--surface-hover);
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.list-body {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 用户卡头 */
.user-card :deep(.panel-head) {
  padding: 10px 14px;
}

.user-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  background: var(--grad-brand);
}

.avatar.sm {
  width: 30px;
  height: 30px;
  font-size: 13px;
}

.nick {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.remove-btn {
  border: none;
  background: transparent;
  color: var(--brand-red);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.09);
}

/* 模块开关行 */
.module-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.module-row:hover {
  background: var(--surface-hover);
}

.module-row + .module-row {
  border-top: 1px solid var(--border-glass);
}

.mod-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 15px;
}

.mod-label {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
}

.empty-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
}

/* 弹层 */
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(4, 8, 18, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 480px;
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: 20px 20px 0 0;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-pop);
}

.picker-sheet .sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 10px;
}

.picker-search {
  margin-bottom: 8px;
}

.picker-list {
  max-height: 46vh;
  overflow-y: auto;
}

.picker-empty {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-3);
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-1);
  cursor: pointer;
}

.picker-item:hover {
  background: var(--surface-hover);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
