<template>
  <div class="login-page">
    <div class="login-card glass">
      <h2>记账助手</h2>
      <p class="subtitle">登录以开始使用</p>
      <el-form @submit.prevent="handleLogin" label-position="top">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
const loading = ref(false);
const form = reactive({ mainServerUrl: '', username: '', password: '' });
async function handleLogin() {
  loading.value = true;
  // TODO: implement login via auth store
  setTimeout(() => { loading.value = false; }, 1000);
}
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
</style>
