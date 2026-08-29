import { defineStore } from 'pinia';
import { authApi } from '@/api';
import router from '@/router';
import { usePrefsStore } from './prefs';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('web_token') || '',
    nickname: localStorage.getItem('web_nickname') || '',
    userId: localStorage.getItem('web_user_id') || '',
    mainServerUrl: localStorage.getItem('web_server_url') || '',
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
  },
  actions: {
    async login(
      mainServerUrl: string,
      username: string,
      password: string,
      opts?: { redirect?: boolean },
    ) {
      const res: any = await authApi.login({ mainServerUrl, username, password });
      this.token = res.access_token;
      this.nickname = res.nickname || username;
      this.userId = res.userId || '';
      this.mainServerUrl = mainServerUrl;
      localStorage.setItem('web_token', res.access_token);
      localStorage.setItem('web_nickname', this.nickname);
      localStorage.setItem('web_user_id', this.userId);
      localStorage.setItem('web_server_url', mainServerUrl);
      if (opts?.redirect !== false) router.push('/');
    },
    /** 拉取当前登录用户信息（服务器地址/账号），登录后与同步设置页展示用 */
    async fetchMe() {
      try {
        const res: any = await authApi.me();
        if (res?.userId) {
          this.userId = res.userId;
          this.nickname = res.nickname || this.nickname;
          this.mainServerUrl = res.mainServerUrl || this.mainServerUrl;
          localStorage.setItem('web_user_id', this.userId);
          localStorage.setItem('web_nickname', this.nickname);
          localStorage.setItem('web_server_url', this.mainServerUrl);
        }
      } catch {
        /* 忽略：保持本地缓存 */
      }
    },
    logout() {
      this.token = '';
      this.nickname = '';
      this.userId = '';
      this.mainServerUrl = '';
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_nickname');
      localStorage.removeItem('web_user_id');
      localStorage.removeItem('web_server_url');
      // 切换账号时清空偏好缓存，避免不同账号互相污染
      try { usePrefsStore().reset(); } catch { /* store 尚未初始化，忽略 */ }
      router.push('/login');
    },
    /**
     * 主端 token 过期/鉴权失效（401）：清除会话，但保留主端地址缓存，
     * 登录页据此自动回填 host，用户只需重输账号密码。
     */
    sessionExpired() {
      this.token = '';
      this.nickname = '';
      this.userId = '';
      localStorage.removeItem('web_token');
      localStorage.removeItem('web_nickname');
      localStorage.removeItem('web_user_id');
      try { usePrefsStore().reset(); } catch { /* ignore */ }
      router.push('/login');
    },
  },
});
