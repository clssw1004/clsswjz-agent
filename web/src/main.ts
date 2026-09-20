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

// ========== dev 模式：第三方性能采集脚本（INP/RUM）噪音静默 ==========
//
// 【报错来源 —— 不是本项目的代码】
// 页面里被注入了一个基于 web-vitals 的 INP 采集脚本（堆栈前缀 VM####，即运行时求值注入，
// 而本项目产物在 dev 下是 /src/*、构建后是 /assets/*，不会出现 VM 前缀）。
// 判定依据：`web/src` 与 `web/node_modules` 全局搜索 reportAllChanges / presentationDelay /
// interactionId / entryGroupId 均无命中（仅本文件命中）；而 WorkBuddy 自带的 app.asar 内
// 确实打包了 web-vitals 的 INP attribution 与 @tencent/aegis-web-sdk-v2，
// 字段名（inputDelay / processingDuration / presentationDelay / interactionType）完全一致。
//
// 【它为什么崩】该脚本在每次交互后组装指标对象时，对 entries 无保护地取下标 0：
//     subparts: { inputDelay, processingDuration, presentationDelay },
//     startTime: t.entries[0].startTime,
//     entryGroupId: t.entries[0].interactionId,
//     interactionType: t.attribution.interactionType
// 当某个交互分组的 entries 为空（快速路由切换 / 元素已卸载 / 分组被清理）时
// entries[0] === undefined → TypeError: Cannot read properties of undefined (reading 'startTime')。
// 这是采集脚本自身的健壮性缺陷，与页面业务逻辑无关，功能完全正常。
//
// 【关键：上一版过滤器为什么没生效】
// 旧判定要求 stack 同时包含 'requestIdleCallback'，但 UA 原生帧不会写进 ErrorEvent.error.stack
// （那行只是 DevTools 控制台额外补齐的 async 调用链）→ 条件永远不成立，控制台一直能看到这条报错。
// 现在改为「消息特征 + 注入脚本内部帧名」的组合签名，不依赖原生帧。
//
// 【为什么不直接删掉静默】这段代码不在本仓库里，改不了源头；只能在应用侧识别并拦掉这条噪音。
// 组合签名足够窄：消息必须是 startTime 越界，且堆栈必须命中采集脚本的内部标识，
// 因此不会吞掉业务代码里真实的 undefined 访问错误。
const PERF_INP_NOISE_MARKERS = [
  'reportAllChanges', // web-vitals 采集入口
  'presentationDelay', // INP 三阶段之一
  'interactionId', // Event Timing 交互分组 id
  'entryGroupId', // 采集脚本对 interactionId 的别名
];

if (import.meta.env.DEV) {
  window.addEventListener('error', (e) => {
    const msg = e?.message || '';
    const stack = (e?.error as Error | undefined)?.stack || '';
    if (
      msg.includes("reading 'startTime'") &&
      PERF_INP_NOISE_MARKERS.some((marker) => stack.includes(marker))
    ) {
      // preventDefault 阻止默认处理（含控制台 "Uncaught" 输出），等价于 window.onerror 返回 true
      e.preventDefault();
    }
  });
}
