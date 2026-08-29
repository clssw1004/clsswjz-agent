import { defineStore } from 'pinia';
import { bookApi } from '@/api';
import { usePrefsStore } from './prefs';

export const useAppStore = defineStore('app', {
  state: () => ({
    books: [] as any[],
    /** 立即从 localStorage 取值做首屏占位（后端加载后会用 prefs 中的值覆盖） */
    currentBookId: localStorage.getItem('currentBookId') || '',
  }),
  getters: {
    currentBook: (s) => s.books.find((b: any) => b.id === s.currentBookId) || null,
  },
  actions: {
    async loadBooks() {
      const res: any = await bookApi.list();
      this.books = Array.isArray(res) ? res : (res?.items || []);
      if (!this.currentBookId && this.books.length > 0) {
        this.currentBookId = this.books[0].id;
        localStorage.setItem('currentBookId', this.currentBookId);
      }
    },
    /**
     * 初始化加载：拉账本 + 拉偏好；
     * 偏好中的 defaultBookId 覆盖 localStorage 缓存；没有则保持 localStorage 默认。
     */
    async bootstrap() {
      const prefs = usePrefsStore();
      await Promise.all([this.loadBooks(), prefs.load()]);
      const serverBookId = prefs.get<string>('defaultBookId');
      if (serverBookId && this.books.some((b: any) => b.id === serverBookId)) {
        // 后端偏好优先 —— 同步覆盖 localStorage
        this.currentBookId = serverBookId;
        localStorage.setItem('currentBookId', serverBookId);
      } else if (serverBookId && this.currentBookId !== serverBookId) {
        // 服务端存了过期/失效的书 id，清掉避免一直 conflict
        await prefs.remove('defaultBookId').catch(() => {});
      }
    },
    /** 切换账本：本地 + 后端偏好同步持久化 */
    async switchBook(id: string) {
      this.currentBookId = id;
      localStorage.setItem('currentBookId', id);
      const prefs = usePrefsStore();
      if (prefs.loaded) {
        try {
          await prefs.set('defaultBookId', id);
        } catch { /* 网络错误不影响本地切换 */ }
      }
    },
  },
});