import { defineStore } from 'pinia';
import { syncApi } from '@/api';

export const useSyncStore = defineStore('sync', {
  state: () => ({
    syncing: false,
    step: '',
    percent: 0,
    unsynced: 0,
    failed: 0,
    _timer: null as any,
  }),
  actions: {
    /** 轮询同步状态：syncing 时 1 秒，空闲时 5 秒（捕捉后台自动同步） */
    startPolling() {
      if (this._timer) return;
      const poll = async () => {
        try {
          const s: any = await syncApi.status();
          this.syncing = !!s.syncing;
          this.step = s.step || '';
          this.percent = s.percent || 0;
          this.unsynced = s.unsynced || 0;
          this.failed = s.failed || 0;
        } catch {
          /* 忽略轮询错误（如网络瞬断） */
        }
      };
      poll();
      this._timer = setInterval(poll, this.syncing ? 1000 : 5000);
    },
    stopPolling() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },
    /** 手动触发一次完整同步（服务端异步执行，进度靠轮询） */
    async triggerSync() {
      if (this.syncing) return;
      try {
        await syncApi.run();
      } catch {
        /* 已在 syncing 或网络错误——轮询会反映真实状态 */
      }
      // 立即进入 1 秒快速轮询
      this.stopPolling();
      this.startPolling();
    },
  },
});
