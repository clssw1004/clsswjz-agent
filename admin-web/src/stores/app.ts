import { defineStore } from 'pinia';
import { bookApi } from '@/api';

export const useAppStore = defineStore('app', {
  state: () => ({
    books: [] as any[],
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
    switchBook(id: string) {
      this.currentBookId = id;
      localStorage.setItem('currentBookId', id);
    },
  },
});
