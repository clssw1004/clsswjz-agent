<template>
  <div class="login-page">
    <div class="login-card glass">
      <h2>记账助手</h2>
      <p class="subtitle">{{ syncing ? '正在同步数据' : '登录以开始使用' }}</p>
      <el-form v-if="!syncing" @submit.prevent="handleLogin" label-position="top">
        <el-form-item label="主端地址">
          <el-input v-model="form.mainServerUrl" placeholder="http://your-server:3000" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width:100%">
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
import { ElMessage } from 'element-plus';
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
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; background: var(--bg-page);
}
.login-card {
  width: 380px; padding: 32px; border-radius: var(--radius-lg);
  background: var(--surface-glass-strong); backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass);
}
h2 { text-align: center; color: var(--text-1); margin-bottom: 4px; }
.subtitle { text-align: center; color: var(--text-3); margin-bottom: 24px; }
.sync-progress { padding: 8px 0 4px; }
.sync-step {
  margin-top: 12px; font-size: 13px; color: var(--text-2);
  text-align: center; min-height: 18px;
}
</style>
