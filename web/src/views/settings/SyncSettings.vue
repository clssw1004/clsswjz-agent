<template>
  <div class="settings-page">
    <div class="page-header">
      <div class="page-header-title">
        <h2>同步设置</h2>
        <span class="count">服务器与账号</span>
      </div>
    </div>

    <!-- 服务器地址 -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><Connection /></el-icon>
        <span>服务器</span>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">主端服务器地址</div>
          <div class="setting-value mono">{{ auth.mainServerUrl || '未配置' }}</div>
        </div>
        <button class="edit-btn" @click="openServerDialog">修改</button>
      </div>
    </div>

    <!-- 账号 -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><UserFilled /></el-icon>
        <span>账号</span>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-name">{{ auth.nickname || '未登录' }}</div>
          <div class="setting-value mono id">{{ auth.userId || '-' }}</div>
        </div>
        <button class="edit-btn" @click="openResetDialog">重置</button>
      </div>
    </div>

    <!-- 同步状态 -->
    <div class="card glass">
      <div class="card-title">
        <el-icon><Cloudy /></el-icon>
        <span>同步状态</span>
      </div>
      <div class="sync-status">
        <template v-if="sync.syncing">
          <div class="sync-spinner-lg"></div>
          <div class="status-line">
            <span class="status-text active">{{ sync.step || '同步中...' }}</span>
            <span class="status-percent">{{ sync.percent || 0 }}%</span>
          </div>
          <el-progress :percentage="sync.percent || 0" :show-text="false" :stroke-width="6" class="sync-progress" />
        </template>
        <template v-else-if="sync.unsynced > 0 || sync.failed > 0">
          <el-icon :size="26" class="status-icon pending"><WarningFilled /></el-icon>
          <div class="status-line">
            <span class="status-text pending">
              待同步 {{ sync.unsynced }} 条{{ sync.failed > 0 ? `，失败 ${sync.failed} 条` : '' }}
            </span>
          </div>
          <p class="status-hint">本地存在未同步的变更，点击下方按钮立即同步到主端。</p>
        </template>
        <template v-else>
          <el-icon :size="26" class="status-icon ok"><CircleCheckFilled /></el-icon>
          <div class="status-line">
            <span class="status-text ok">数据已同步</span>
          </div>
          <p class="status-hint">所有本地变更已同步到主端，暂无待同步数据。</p>
        </template>
      </div>

      <button class="sync-action-btn" :disabled="sync.syncing" @click="handleSync">
        <el-icon v-if="sync.syncing" class="sync-action-icon"><Loading /></el-icon>
        <el-icon v-else class="sync-action-icon"><Refresh /></el-icon>
        <span>{{ sync.syncing ? '同步中...' : '立即同步' }}</span>
      </button>
    </div>

    <!-- 数据管理（危险操作） -->
    <div class="card glass danger-card">
      <div class="card-title">
        <el-icon><Warning /></el-icon>
        <span>数据管理</span>
      </div>
      <div class="danger-row">
        <div class="danger-info">
          <div class="danger-name">重置并全量同步</div>
          <div class="danger-desc">
            清空本地全部数据（对应用户库的表数据）后，从主端全量重新同步，
            用于修复同步遗漏导致的存量数据缺失或本地数据异常。同步过程中请勿关闭页面。
          </div>
        </div>
        <button class="danger-btn" :disabled="sync.syncing" @click="handleResync">重置并全量同步</button>
      </div>
    </div>

    <!-- 重置授权 弹窗（对齐移动端 reset_auth） -->
    <el-dialog
      v-model="dialogVisible"
      title="重置授权"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" @submit.prevent="handleRefreshCredential">
        <el-form-item label="主端地址">
          <el-input v-model="credForm.mainServerUrl" placeholder="http://your-server:3000" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="credForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="credForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <p class="dialog-hint">
          刷新凭证：仅更新服务器地址与登录凭证，保留本地数据。
          <br />
          重置凭证 &amp; 数据重置同步：清理本地全部数据后，从该账号主端重新同步。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :loading="submitting" @click="handleRefreshCredential">刷新凭证</el-button>
        <el-button type="danger" :loading="submitting" @click="handleResetAndSync">
          重置凭证&数据重置同步
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue';
import {
  Connection,
  UserFilled,
  Cloudy,
  Refresh,
  Loading,
  Warning,
  WarningFilled,
  CircleCheckFilled,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { useAppStore } from '@/stores/app';

const auth = useAuthStore();
const sync = useSyncStore();
const app = useAppStore();

const dialogVisible = ref(false);
const submitting = ref(false);
const credForm = reactive({ mainServerUrl: '', username: '', password: '' });

onMounted(() => {
  auth.fetchMe();
  sync.startPolling();
});

onUnmounted(() => {
  sync.stopPolling();
});

/** 修改服务器地址（预填当前地址，保留原账号） */
function openServerDialog() {
  credForm.mainServerUrl = auth.mainServerUrl;
  credForm.username = '';
  credForm.password = '';
  dialogVisible.value = true;
}

/** 重置授权（对齐移动端 sync_settings 的"重置"→ reset_auth：刷新凭证 / 重置凭证&数据重置同步） */
function openResetDialog() {
  credForm.mainServerUrl = auth.mainServerUrl;
  credForm.username = '';
  credForm.password = '';
  dialogVisible.value = true;
}

function validateForm() {
  if (!credForm.mainServerUrl || !credForm.username || !credForm.password) {
    ElMessage.warning('请填写主端地址、用户名和密码');
    return false;
  }
  return true;
}

/** 1. 刷新凭证（对齐移动端 _handleRefreshCredentials）：重新认证，仅更新 serverUrl/token，保留本地数据 */
async function handleRefreshCredential() {
  if (!validateForm()) return;
  submitting.value = true;
  try {
    await auth.login(
      credForm.mainServerUrl,
      credForm.username,
      credForm.password,
      { redirect: false },
    );
    dialogVisible.value = false;
    ElMessage.success('凭证已刷新');
    await auth.fetchMe();
    // 重新认证后触发一次同步，拉取新服务器/新账号的增量数据
    sync.triggerSync().then(() => setTimeout(() => app.loadBooks(), 500));
  } catch {
    /* 错误已由 http 拦截器提示 */
  } finally {
    submitting.value = false;
  }
}

/** 2. 重置凭证 & 数据重置同步（对齐移动端 reset 模式）：重新认证 + 清理本地数据后全量重拉 */
async function handleResetAndSync() {
  if (!validateForm()) return;
  try {
    await ElMessageBox.confirm(
      '将重新认证，并删除本地全部数据（账目、分类、项目、标签等）后从主端全量重新同步。' +
        '本地未同步的变更会先推送后再清理。同步期间请勿关闭页面。是否继续？',
      '重置凭证 & 数据重置同步',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' },
    );
  } catch {
    return; // 用户取消
  }
  submitting.value = true;
  try {
    await auth.login(
      credForm.mainServerUrl,
      credForm.username,
      credForm.password,
      { redirect: false },
    );
    dialogVisible.value = false;
    ElMessage.success('已重置本地数据，正在从主端全量重新同步');
    await auth.fetchMe();
    await sync.triggerResync(true);
  } catch {
    /* 错误已由 http 拦截器提示 */
  } finally {
    submitting.value = false;
  }
}

function handleSync() {
  sync.triggerSync().then(() => {
    setTimeout(() => app.loadBooks(), 500);
  });
}

async function handleResync() {
  if (sync.syncing) return;
  try {
    await ElMessageBox.confirm(
      '将删除本地全部数据（账目、分类、项目、标签等，对应用户库的表数据）后，从主端全量重新同步。' +
        '本地未同步的变更会先推送后再清理。同步期间请勿关闭页面，是否继续？',
      '重置并全量同步',
      { type: 'warning', confirmButtonText: '开始同步', cancelButtonText: '取消' },
    );
  } catch {
    return; // 用户取消
  }
  sync.triggerResync(true).then(() => {
    ElMessage.success('已开始全量重拉，本地数据已清空，完成后将从主端补齐');
    setTimeout(() => app.loadBooks(), 500);
  });
}
</script>

<style scoped>
.page-header {
  margin-bottom: 18px;
}

.page-header-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
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

.card.glass {
  background: var(--surface-glass);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 18px;
  margin-bottom: 14px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 14px;
}

.card-title .el-icon {
  color: var(--brand);
  font-size: 16px;
}

/* 设置行（服务器/账号） */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
}

.setting-value {
  font-size: 13px;
  color: var(--text-2);
  word-break: break-all;
}

.setting-value.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.setting-value.id {
  color: var(--text-3);
  font-size: 11px;
}

.edit-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--brand);
  background: transparent;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s ease;
}

.edit-btn:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
}

/* 同步状态 */
.sync-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 0 8px;
  min-height: 96px;
  justify-content: center;
}

.sync-spinner-lg {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-glass);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-icon.ok { color: var(--ok, #43a047); }
.status-icon.pending { color: var(--warn, #e6a23c); }

.status-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-text { font-size: 15px; font-weight: 600; }
.status-text.active { color: var(--brand); }
.status-text.pending { color: var(--warn, #e6a23c); }
.status-text.ok { color: var(--ok, #43a047); }

.status-percent {
  font-size: 13px;
  color: var(--text-3);
}

.status-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}

.sync-progress {
  width: 100%;
  max-width: 280px;
}

.sync-action-btn {
  width: 100%;
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: var(--grad-brand);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.sync-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  opacity: 0.92;
}

.sync-action-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.sync-action-icon {
  font-size: 16px;
}

/* 危险操作 */
.danger-card {
  border-color: rgba(229, 77, 66, 0.25);
}

.danger-card .card-title .el-icon {
  color: #e54d42;
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.danger-info {
  flex: 1;
  min-width: 0;
}

.danger-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
}

.danger-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}

.danger-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  font-size: 13px;
  color: #e54d42;
  background: transparent;
  border: 1px solid rgba(229, 77, 66, 0.45);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.danger-btn:hover:not(:disabled) {
  background: rgba(229, 77, 66, 0.08);
}

.danger-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.dialog-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.6;
}

@media (max-width: 767px) {
  .danger-row {
    flex-direction: column;
    align-items: stretch;
  }

  .danger-btn {
    text-align: center;
  }
}
</style>
