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

export function useResponsive() {
  const width = ref(window.innerWidth);

  const update = () => {
    width.value = window.innerWidth;
  };

  onMounted(() => window.addEventListener('resize', update));
  onUnmounted(() => window.removeEventListener('resize', update));

  const isMobile = computed(() => width.value < 768);
  const isTablet = computed(() => width.value >= 768 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);

  return { isMobile, isTablet, isDesktop, isPhone: isMobile };
}
