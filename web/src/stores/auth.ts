import { defineStore } from 'pinia';
import { authApi } from '@/api';
import router from '@/router';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('web_token') || '',
    nickname: localStorage.getItem('web_nickname') || '',
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
  },
  actions: {
    async login(mainServerUrl: string, username: string, password: string) {
      const res: any = await authApi.login({ mainServerUrl, username, password });
      this.token = res.access_token;
      this.nickname = res.nickname || username;
      localStorage.setItem('web_token', res.access_token);
      localStorage.setItem('web_nickname', this.nickname);
      router.push('/');
    },
    logout() {
      this.token = '';
      this.nickname = '';
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_nickname');
      router.push('/login');
    },
  },
});
