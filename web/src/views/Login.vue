<template>
  <div class="login-page">
    <div class="login-card glass">
      <div class="brand">
        <div class="brand-badge">
          <el-icon :size="26"><Coin /></el-icon>
        </div>
        <h2>记账助手</h2>
        <p class="subtitle">{{ syncing ? '正在同步数据' : '登录以开始使用' }}</p>
      </div>

      <el-form v-if="!syncing" @submit.prevent="handleLogin" label-position="top" class="login-form">
        <el-form-item label="主端地址">
          <el-input v-model="form.mainServerUrl" placeholder="http://your-server:3000" size="large">
            <template #prefix><el-icon><Connection /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" size="large" placeholder="请输入用户名">
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password size="large" placeholder="请输入密码">
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="submit-btn" size="large">
          登录
        </el-button>
      </el-form>

      <!-- 首次同步进度（对齐移动端登录页 ProgressIndicatorBar） -->
      <div v-else class="sync-progress">
        <el-progress
          :percentage="sync.percent"
          :stroke-width="10"
          :show-text="false"
          striped
          striped-flow
        />
        <p class="sync-step">{{ sync.step || '准备中...' }} {{ sync.percent }}%</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue';
import { Coin, Connection, User, Lock } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';

const router = useRouter();
const auth = useAuthStore();
const sync = useSyncStore();
const loading = ref(false);
// 同步阶段：登录成功后等待 P0+P1 关键数据同步完成再进入（对齐移动端）
const syncing = ref(false);
let pollTimer: any = null;
const form = reactive({ mainServerUrl: '', username: '', password: '' });

async function handleLogin() {
  if (!form.mainServerUrl || !form.username || !form.password) {
    ElMessage.warning('请填写主端地址、用户名和密码');
    return;
  }
  loading.value = true;
  try {
    const res: any = await auth.login(form.mainServerUrl, form.username, form.password);
    if (res?.initialSyncing) {
      // 进入同步等待阶段：轮询进度，P0+P1 完成后跳转主页面
      syncing.value = true;
      await waitForInitialSync();
    }
  } catch {
    /* 错误已由 http 拦截器提示 */
  } finally {
    loading.value = false;
  }
}

/** 轮询 /sync/status 直到首次关键数据同步完成 */
async function waitForInitialSync() {
  const startedAt = Date.now();
  const TIMEOUT_MS = 30_000; // 超时保护：30 秒后强制进入（后台继续同步）
  return new Promise<void>((resolve) => {
    pollTimer = setInterval(async () => {
      try {
        await sync.pollOnce();
      } catch { /* 忽略单次轮询失败 */ }
      // 关键数据同步完成（或超时兜底）→ 进主页面；剩余数据由后台同步+顶栏状态条接管
      if (!sync.syncing || Date.now() - startedAt > TIMEOUT_MS) {
        clearInterval(pollTimer);
        router.push('/');
        resolve();
      }
    }, 800);
  });
}

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.login-card {
  width: 400px;
  max-width: 100%;
  padding: 36px 32px 32px;
  border-radius: var(--radius-xl);
  background: var(--surface-glass-strong);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-pop);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 26px;
}

.brand-badge {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: #fff;
  background: var(--grad-brand);
  box-shadow: var(--glow-primary);
  margin-bottom: 14px;
}

.brand h2 {
  margin: 0 0 6px;
  font-size: 22px;
  color: var(--text-1);
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

.login-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: var(--text-2);
  padding-bottom: 4px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  font-weight: 600;
  background: var(--grad-brand);
  border: none;
  box-shadow: var(--glow-primary);
}

.submit-btn:hover {
  opacity: 0.92;
}

.sync-progress {
  padding: 8px 0 4px;
}

.sync-step {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-2);
  text-align: center;
  min-height: 18px;
}

@media (max-width: 767px) {
  .login-page {
    align-items: flex-start;
    padding-top: 8vh;
  }
}
</style>
