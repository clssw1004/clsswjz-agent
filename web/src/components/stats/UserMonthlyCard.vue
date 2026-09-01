<template>
  <Panel title="成员" :icon="UserFilled">
    <template #head>
      <span class="legend">
        <i class="dot dot-income"></i>收入
        <i class="dot dot-expense"></i>支出
      </span>
    </template>

    <div v-if="users.length" class="chart">
      <div class="grid">
        <i v-for="g in 4" :key="g" :style="{ top: (g * 25) + '%' }"></i>
      </div>
      <div class="groups">
        <div v-for="u in users" :key="u.userId" class="grp">
          <!-- hover 浮层：笔数 / 收入 / 支出 -->
          <div class="tip">
            <b>{{ u.userName }}</b>
            <span>账目 {{ u.count }} 笔</span>
            <span class="tip-row"><i class="dot dot-income"></i>收入 ¥{{ fmtNum(u.income) }}</span>
            <span class="tip-row"><i class="dot dot-expense"></i>支出 ¥{{ fmtNum(u.expense) }}</span>
          </div>
          <div class="bars">
            <div class="bar bar-income" :style="{ height: h(u.income) }"></div>
            <div class="bar bar-expense" :style="{ height: h(u.expense) }"></div>
          </div>
          <span class="name">{{ u.userName }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="72" description="本月暂无成员账目" />
  </Panel>
</template>

<script setup lang="ts">
/**
 * 成员统计（当月按用户成对柱状图）—— 对齐 Ardot 原型「04-成员统计」/ gui UserMonthlyStatisticChart。
 * 数据按 createdBy 聚合（对齐 gui statistic_service getCurrentMonthUserStatistic 按 accountItem.createdBy 分组）。
 */
import { computed } from 'vue';
import { UserFilled } from '@element-plus/icons-vue';
import Panel from '@/components/Panel.vue';

const props = defineProps<{
  users: { userId: string; userName: string; income: number; expense: number; count: number }[];
}>();

const maxVal = computed(() => {
  let m = 0;
  for (const u of props.users) {
    if (u.income > m) m = u.income;
    if (Math.abs(u.expense) > m) m = Math.abs(u.expense);
  }
  return m || 1;
});

function h(v: number) {
  const a = Math.abs(v);
  if (!a) return '2px';
  return Math.max(2, Math.round((a / maxVal.value) * 100)) + '%';
}

function fmtNum(v: number) {
  return Math.abs(v).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
</script>

<style scoped>
.legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot-income {
  background: var(--amount-income);
}

.dot-expense {
  background: var(--amount-expense);
}

.legend .dot {
  margin-left: 2px;
}

/* 图表区 */
.chart {
  position: relative;
  height: 240px;
  padding: 4px 4px 0;
}

.grid {
  position: absolute;
  inset: 4px 0 28px;
  pointer-events: none;
}

.grid i {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--border-glass-strong);
}

.groups {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 8px;
  height: 100%;
  padding-bottom: 26px;
}

.grp {
  position: relative;
  flex: 1;
  max-width: 64px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100%;
  width: 100%;
  justify-content: center;
}

.bar {
  width: 12px;
  max-width: 50%;
  border-radius: 6px; /* 全圆角（对齐 gui BorderRadius.all(6)） */
  transition: height 0.3s ease;
}

.bar-income {
  background: linear-gradient(180deg, rgba(67, 160, 71, 0.72), rgba(67, 160, 71, 0.95));
}

.bar-expense {
  background: linear-gradient(180deg, rgba(185, 91, 75, 0.72), rgba(185, 91, 75, 0.95));
}

.name {
  font-size: 11px;
  color: var(--text-2);
  font-weight: 500;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* hover 浮层（对齐原型 Tooltip） */
.tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  min-width: 118px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-glass-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-float);
  padding: 8px 10px;
  display: none;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
}

.tip b {
  font-size: 12px;
  color: var(--text-1);
  margin-bottom: 2px;
}

.tip-row {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.grp:hover .tip {
  display: flex;
}

.grp:hover .name {
  color: var(--brand-gold);
}
</style>
