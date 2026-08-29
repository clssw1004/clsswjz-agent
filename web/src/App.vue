<template>
  <el-config-provider :locale="zhCn">
    <div class="app-shell">
      <div class="app-bg" aria-hidden="true"></div>
      <router-view />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>

<style scoped>
.app-shell {
  position: relative;
  z-index: 0;
  min-height: 100vh;
}
</style>
