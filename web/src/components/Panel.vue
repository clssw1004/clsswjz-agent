<template>
  <section
    class="panel"
    :class="{ 'is-clickable': clickable, 'is-accent': accent }"
    @click="clickable && emit('click')"
  >
    <!-- 标题栏：icon + title + 中间插槽 + 右侧 action -->
    <div v-if="title || $slots.head || $slots.action" class="panel-head">
      <el-icon v-if="icon" :size="16" class="panel-head-icon">
        <component :is="icon" />
      </el-icon>
      <span v-if="title" class="panel-title">{{ title }}</span>
      <span v-if="$slots.head" class="panel-head-slot"><slot name="head" /></span>
      <span v-if="$slots.action" class="panel-head-action"><slot name="action" /></span>
    </div>
    <!-- head 与 body 之间的分隔线（列表类卡片用，紧贴 head 下方） -->
    <div v-if="divider" class="panel-divider"></div>
    <div v-if="$slots.default" class="panel-body" :class="{ 'no-pad': noPad }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Panel — 全局统一玻璃卡片容器（记账/功能/统计等页面共用）
 * 设计 token 对齐各页既有 glass 视觉：surface-glass 背景 + radius-lg 圆角 + 卡片阴影。
 * props:
 *  - title: 标题文字（有 head 时显示）
 *  - icon:  标题前图标（Element Plus 图标组件）
 *  - accent: 金色强调头部（统计卡头部用）
 *  - clickable: 整卡可点击（月份切换条用）
 *  - noPad: body 无内边距（内容自带 padding 的容器用）
 *  - divider: head 与 body 之间渲染 1px 分隔线（列表类卡片用）
 * slots:
 *  - default: 卡片主体
 *  - head:    标题栏中间弹性区域（账本名/统计信息）
 *  - action:  标题栏右侧操作区（切换/更多按钮）
 */
import { defineEmits, defineProps } from 'vue';

defineProps<{
  title?: string;
  icon?: any;
  accent?: boolean;
  clickable?: boolean;
  noPad?: boolean;
  divider?: boolean;
}>();

const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.panel {
  background: var(--surface-glass);
  border: 1px solid var(--border-glass);
  backdrop-filter: var(--blur-glass);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel.is-clickable {
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.panel.is-clickable:hover {
  background: var(--surface-hover);
  border-color: var(--border-glass-strong);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 8px;
  color: var(--text-1);
  line-height: 1;
}

.panel-head.is-accent,
.panel.is-accent .panel-head {
  background: var(--brand-gold-soft);
  color: var(--brand-gold-dark);
}

.panel-head-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  min-height: 16px;
}

.panel.is-accent .panel-title {
  color: var(--brand-gold-dark);
}

.panel-head-slot {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-head-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-body {
  padding: 8px 12px 12px;
}

.panel-body.no-pad {
  padding: 0;
}

.panel-divider {
  height: 1px;
  background: var(--border-glass);
}
</style>
