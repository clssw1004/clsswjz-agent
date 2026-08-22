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
