import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import path from 'path';

export default defineConfig(({ mode }) => {
  // 代理目标：默认本机 agent 后端（3001），可用 web/.env.development 的 VITE_PROXY_TARGET 覆盖
  const env = loadEnv(mode, process.cwd(), '');
  const agentTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001';

  return {
    plugins: [
      vue(),
      // Element Plus 按需引入：ElMessage/ElMessageBox 等函数 API + 组件 + 各自样式
      // 注：dts 关闭（本机对该路径写入受限），不影响按需引入功能，仅少编辑器类型提示
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: false,
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: false,
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: agentTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          // vue 生态拆独立 chunk，利于缓存 & 首屏
          manualChunks(id) {
            if (id.includes('vue-echarts')) return 'vue-echarts';
          },
        },
      },
    },
  };
});
