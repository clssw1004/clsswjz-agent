import { createApp } from 'vue';
import { createPinia } from 'pinia';
// 按需引入：命令式 API 与 v-loading 指令不走模板解析，需手动注册样式/插件
import { ElLoading } from 'element-plus';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
import App from './App.vue';
import router from './router';
import './styles/tokens.css';
import { initTheme } from './styles/themes';

// 应用主题（含持久化的主题色与明暗模式）
initTheme();

createApp(App).use(createPinia()).use(router).use(ElLoading).mount('#app');

// ========== dev 模式良性 bug 静默 ==========
// Vue 3.5.x + 异步组件 hydrateOnIdle（via requestIdleCallback）在 Vue DevTools 7 hook
// 内部对已 dispose 的 effect 访问 .startTime，会抛 "Cannot read properties of undefined (reading 'startTime')"。
// 这是 Vue 调度器与 DevTools performance tracking 的兼容性问题，**不影响业务功能**（页面正常显示/交互）。
// 仅 dev 模式 + DevTools 启用时报错，生产构建（npm run build）不会出现。
// 静默前先确认是这条已知路径，避免误吞其他真实错误。
if (import.meta.env.DEV) {
  window.addEventListener('error', (e) => {
    const msg = e?.message || '';
    const stack = e?.error?.stack || '';
    if (
      msg.includes("reading 'startTime'") &&
      stack.includes('reportAllChanges') &&
      stack.includes('requestIdleCallback')
    ) {
      e.preventDefault();
    }
  });
}
