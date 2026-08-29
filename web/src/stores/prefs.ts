import { defineStore } from 'pinia';
import { ref } from 'vue';
import { userPrefApi } from '@/api';

/**
 * 用户偏好 store —— 持久化到后端（per-user SQLite preferences 列）。
 *
 * 设计：
 * - load() 拉取一次完整对象到本地缓存；set/remove 单点更新并同步写回后端
 * - 偏好不参与主端同步（agent-local view state）
 * - 登录后或路由初始化时调用 load() 一次即可
 */
export const usePrefsStore = defineStore('prefs', () => {
  const prefs = ref<Record<string, any>>({});
  const loaded = ref(false);
  const loading = ref(false);

  async function load(force = false) {
    if (loading.value) return;
    if (loaded.value && !force) return;
    loading.value = true;
    try {
      const res: any = await userPrefApi.get();
      prefs.value = res && typeof res === 'object' && !Array.isArray(res) ? res : {};
      loaded.value = true;
    } catch {
      prefs.value = {};
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function set(key: string, value: any) {
    prefs.value[key] = value;
    try {
      await userPrefApi.update({ [key]: value });
    } catch (e) {
      // 回滚本地状态避免与服务端长期不一致
      delete prefs.value[key];
      throw e;
    }
  }

  async function remove(key: string) {
    const prev = prefs.value[key];
    delete prefs.value[key];
    try {
      await userPrefApi.update({ [key]: null });
    } catch (e) {
      prefs.value[key] = prev;
      throw e;
    }
  }

  function get<T = any>(key: string, fallback?: T): T {
    const v = prefs.value[key];
    return (v === undefined || v === null ? (fallback as any) : (v as T));
  }

  function reset() {
    prefs.value = {};
    loaded.value = false;
  }

  return { prefs, loaded, loading, load, set, get, remove, reset };
});
