import { ref, computed, onMounted, onUnmounted } from 'vue';

export interface ResponsiveState {
  /** < 768px：手机 */
  isMobile: boolean;
  /** 768–1023px：平板 */
  isTablet: boolean;
  /** >= 1024px：桌面 */
  isDesktop: boolean;
  /** < 768px（兼容别名） */
  readonly isPhone: boolean;
}

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * 响应式断点：基于 matchMedia 监听（而非仅 resize 事件）。
 * 原因：resize 事件在 iframe 预览、DevTools 设备模拟、部分 WebView 中不会稳定触发，
 * 会导致页面"切了窗口宽度要刷新才生效"。matchMedia 断点由浏览器媒体查询驱动，即时且可靠。
 */
export function useResponsive() {
  const isMobile = ref(window.matchMedia(MOBILE_QUERY).matches);
  const isTablet = ref(window.matchMedia(TABLET_QUERY).matches);
  const isDesktop = ref(window.matchMedia(DESKTOP_QUERY).matches);

  let mqs: MediaQueryList[] = [];
  let raf = 0;

  const update = () => {
    // 用 rAF 合并同帧多次变更，避免抖动
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      isMobile.value = window.matchMedia(MOBILE_QUERY).matches;
      isTablet.value = window.matchMedia(TABLET_QUERY).matches;
      isDesktop.value = window.matchMedia(DESKTOP_QUERY).matches;
    });
  };

  onMounted(() => {
    mqs = [MOBILE_QUERY, TABLET_QUERY, DESKTOP_QUERY].map((q) => {
      const mq = window.matchMedia(q);
      // 现代 API：addEventListener；旧浏览器回退 addListener
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', update);
      } else {
        mq.addListener(update);
      }
      return mq;
    });
    // resize 兜底（覆盖 matchMedia 未覆盖的布局漂移场景）
    window.addEventListener('resize', update);
  });

  onUnmounted(() => {
    if (raf) cancelAnimationFrame(raf);
    mqs.forEach((mq) => {
      if (typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', update);
      } else {
        mq.removeListener(update);
      }
    });
    window.removeEventListener('resize', update);
  });

  return {
    isMobile: computed(() => isMobile.value),
    isTablet: computed(() => isTablet.value),
    isDesktop: computed(() => isDesktop.value),
    isPhone: computed(() => isMobile.value),
  };
}
