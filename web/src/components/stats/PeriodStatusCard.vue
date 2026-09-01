<template>
  <Panel title="经期" :icon="Drizzling">
    <template #action>
      <span class="list-more" @click="router.push('/periods')">
        查看全部<el-icon :size="14"><ArrowRight /></el-icon>
      </span>
    </template>

    <div v-loading="loading" class="period-body" :class="'phase-' + phase">
      <!-- 经期中 -->
      <template v-if="phase === 'period'">
        <div class="p-row">
          <span class="p-tag tag-period">经期中</span>
          <span class="p-bignum"><b>{{ periodDay }}</b><i>第 {{ periodDay }} 天</i></span>
        </div>
        <div class="p-sub">开始于 {{ activeCycle?.startDate || '-' }}</div>
        <div class="p-progress">
          <div class="p-progress-fill" :style="{ width: periodProgress + '%' }"></div>
        </div>
        <div class="p-progress-caption">第 {{ periodDay }} 天 / 平均 {{ avgPeriod }} 天</div>
        <div v-if="overAvg" class="p-warn">
          <el-icon :size="13"><WarningFilled /></el-icon>
          <span>已超过平均经期 {{ avgPeriod }} 天，记得及时结束记录</span>
        </div>
        <button class="p-btn btn-end" :disabled="operating" @click="confirmEnd">
          经期结束
        </button>
      </template>

      <!-- 预测经期 -->
      <template v-else-if="phase === 'predicted'">
        <span class="p-tag tag-predicted">即将到来</span>
        <div class="p-title">{{ predictedDueText }}</div>
        <div class="p-desc">经期预测基于你最近的周期记录，若已开始请点击下方按钮</div>
        <button class="p-btn btn-start" :disabled="operating" @click="confirmStart">
          标记开始
        </button>
      </template>

      <!-- 排卵期 -->
      <template v-else-if="phase === 'ovulation'">
        <span class="p-tag tag-ovulation">🥚 排卵</span>
        <div class="p-title">易孕期</div>
        <div class="p-info-row">排卵日 {{ stats.ovulationDate || '-' }}</div>
        <div class="p-info-row">易孕期 {{ stats.fertileWindow || '-' }}</div>
        <div class="p-desc">距下次经期 {{ daysUntilNext ?? '-' }} 天</div>
      </template>

      <!-- 安全期 -->
      <template v-else-if="phase === 'safe'">
        <span class="p-tag tag-safe">✿ 安全</span>
        <div class="p-title">低风险期</div>
        <div class="p-info-row">距下次经期 {{ daysUntilNext ?? '-' }} 天</div>
        <div class="p-info-row" v-if="stats.ovulationDate">排卵日 {{ stats.ovulationDate }}</div>
        <div class="p-info-row" v-if="stats.nextPeriodDate">预计 {{ stats.nextPeriodDate }}</div>
        <div v-if="overdueDays" class="p-warn">
          <el-icon :size="13"><WarningFilled /></el-icon>
          <span>预测经期已过 {{ overdueDays }} 天仍未记录，是否已开始？</span>
        </div>
      </template>

      <!-- 有记录但数据不足 -->
      <template v-else-if="phase === 'needmore'">
        <el-icon :size="26" class="p-emoji"><DataAnalysis /></el-icon>
        <div class="p-title">继续记录，解锁预测</div>
        <div class="p-desc">至少需要 2 个完整周期才能预测，当前已有 {{ cycleCount }} 个周期</div>
        <button class="p-btn btn-start" :disabled="operating" @click="confirmStart">
          标记开始
        </button>
      </template>

      <!-- 无数据 -->
      <template v-else>
        <el-icon :size="28" class="p-emoji"><Watermelon /></el-icon>
        <div class="p-title">记录你的第一个经期</div>
        <div class="p-desc">点击下方按钮开始记录，之后可随时补记历史周期</div>
        <button class="p-btn btn-start" :disabled="operating" @click="confirmStart">
          标记开始
        </button>
      </template>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * 经期状态卡 —— 对齐 Ardot 原型「07-经期状态」/ gui PeriodStatusCard。
 * 预测算法与 Periods.vue 完全一致（对齐 gui PeriodCalcUtil / PeriodPredictionService），
 * 数据：active 周期 + 近 60 天周期。
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Drizzling, ArrowRight, WarningFilled, DataAnalysis, Watermelon,
} from '@element-plus/icons-vue';
import { periodApi } from '@/api';
import Panel from '@/components/Panel.vue';

const router = useRouter();

// ===== 常量（对齐 Periods.vue / gui PeriodConstants） =====
const LUTEAL_PHASE = 14;
const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;
const DEFAULT_PERIOD_DAYS = 5;
const DEFAULT_CYCLE_DAYS = 28;
const MIN_CYCLE = 15, MAX_CYCLE = 60;

// ===== 状态 =====
const recentCycles = ref<any[]>([]);
const activeCycle = ref<any>(null);
const loading = ref(false);
const operating = ref(false);

const todayStr = fmtDate(new Date());
const cycles = computed(() => {
  const map = new Map<string, any>();
  for (const c of recentCycles.value) map.set(c.id, c);
  if (activeCycle.value) map.set(activeCycle.value.id, activeCycle.value);
  return [...map.values()];
});

// ===== 预测算法（与 Periods.vue 一致） =====
const stats = computed(() => {
  const sorted = cycles.value
    .filter((c) => c.startDate)
    .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) {
    return { canPredict: false, avgCycleLength: 0, avgPeriodLength: 0, nextPeriodDate: '', ovulationDate: '', fertileWindow: '', fertileWindowStart: '', fertileWindowEnd: '' };
  }

  const cycleLengths: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const len = daysBetween(sorted[i].startDate, sorted[i + 1].startDate);
    if (len > MIN_CYCLE && len < MAX_CYCLE) cycleLengths.push(len);
  }
  const periodLengths: number[] = [];
  for (const c of sorted) {
    if (c.endDate) {
      const len = daysBetween(c.startDate, c.endDate) + 1;
      if (len < 15 && len > 0) periodLengths.push(len);
    }
  }
  let typicalCycle = 0, typicalPeriod = 0;
  for (const c of [...sorted].reverse()) {
    if (!typicalCycle && c.typicalCycleDays >= MIN_CYCLE && c.typicalCycleDays <= MAX_CYCLE) typicalCycle = c.typicalCycleDays;
    if (!typicalPeriod && c.typicalPeriodDays >= 2 && c.typicalPeriodDays <= 14) typicalPeriod = c.typicalPeriodDays;
  }

  const avgCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((s, v) => s + v, 0) / cycleLengths.length) : (typicalCycle || DEFAULT_CYCLE_DAYS);
  const avgPeriod = periodLengths.length ? Math.round(periodLengths.reduce((s, v) => s + v, 0) / periodLengths.length) : (typicalPeriod || DEFAULT_PERIOD_DAYS);
  const canPredict = cycleLengths.length > 0 || typicalCycle > 0;

  const lastStart = sorted[sorted.length - 1].startDate;
  const nextDate = addDays(lastStart, avgCycle);
  const ovDay = addDays(nextDate, -LUTEAL_PHASE);
  const fertileStart = addDays(ovDay, -FERTILE_BEFORE);
  const fertileEnd = addDays(ovDay, FERTILE_AFTER);

  return {
    canPredict,
    avgCycleLength: avgCycle,
    avgPeriodLength: avgPeriod,
    nextPeriodDate: nextDate,
    ovulationDate: ovDay,
    fertileWindow: `${fertileStart} ~ ${fertileEnd}`,
    fertileWindowStart: fertileStart,
    fertileWindowEnd: fertileEnd,
  };
});

// ===== 阶段 =====
type Phase = 'period' | 'predicted' | 'ovulation' | 'safe' | 'nodata' | 'needmore';
const phase = computed<Phase>(() => {
  if (activeCycle.value) return 'period';
  const hasRecords = cycles.value.length > 0;
  if (hasRecords && !stats.value.canPredict) return 'needmore';
  if (!stats.value.canPredict) return 'nodata';
  const next = stats.value.nextPeriodDate;
  if (next) {
    const windowEnd = addDays(next, stats.value.avgPeriodLength - 1);
    if (todayStr >= next && todayStr <= windowEnd) return 'predicted';
  }
  if (stats.value.fertileWindowStart && stats.value.fertileWindowEnd) {
    if (todayStr >= stats.value.fertileWindowStart && todayStr <= stats.value.fertileWindowEnd) return 'ovulation';
  }
  return 'safe';
});

const periodDay = computed(() =>
  activeCycle.value ? Math.max(1, daysBetween(activeCycle.value.startDate, todayStr) + 1) : 1
);
const avgPeriod = computed(() => stats.value.avgPeriodLength || DEFAULT_PERIOD_DAYS);
const periodProgress = computed(() => Math.min(100, Math.round((periodDay.value / avgPeriod.value) * 100)));
const overAvg = computed(() => periodDay.value > avgPeriod.value);
const daysUntilNext = computed(() => {
  if (!stats.value.canPredict || !stats.value.nextPeriodDate) return null;
  const diff = daysBetween(todayStr, stats.value.nextPeriodDate);
  return diff >= 0 ? diff : 0;
});
const overdueDays = computed(() => {
  if (!stats.value.canPredict || !stats.value.nextPeriodDate) return null;
  const windowEnd = addDays(stats.value.nextPeriodDate, stats.value.avgPeriodLength - 1);
  const diff = daysBetween(windowEnd, todayStr);
  return diff > 0 ? diff : null;
});
const predictedDueText = computed(() => {
  if (overdueDays.value) return `预计经期已过 ${overdueDays.value} 天，请确认是否已开始`;
  const diff = daysBetween(todayStr, stats.value.nextPeriodDate);
  return diff > 0 ? `预计 ${stats.value.nextPeriodDate} 到来，还有 ${diff} 天` : '经期预计已开始，请记录';
});
const cycleCount = computed(() => cycles.value.filter((c) => c.endDate).length + 1);

// ===== 操作 =====
async function confirmStart() {
  const ok = await ElMessageBox.confirm('标记今天为经期开始？', '标记开始', {
    confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning',
  }).catch(() => false);
  if (!ok) return;
  operating.value = true;
  try {
    await periodApi.createCycle({ startDate: todayStr });
    ElMessage.success('已开始记录');
    await load();
  } catch {
    ElMessage.error('操作失败');
  } finally {
    operating.value = false;
  }
}

async function confirmEnd() {
  const c = activeCycle.value;
  if (!c) return;
  const ok = await ElMessageBox.confirm(`确定结束经期吗？\n${c.startDate} → ${todayStr}`, '结束经期', {
    confirmButtonText: '确认结束', cancelButtonText: '取消', type: 'warning',
  }).catch(() => false);
  if (!ok) return;
  operating.value = true;
  try {
    await periodApi.updateCycleEnd(c.id, todayStr);
    ElMessage.success('已结束');
    await load();
  } catch {
    ElMessage.error('操作失败');
  } finally {
    operating.value = false;
  }
}

// ===== 数据加载 =====
async function load() {
  loading.value = true;
  try {
    const [recent, active]: any = await Promise.all([
      periodApi.listCycles({ recent: 60 }),
      periodApi.listCycles({ active: 'true' }),
    ]);
    recentCycles.value = Array.isArray(recent) ? recent : [];
    activeCycle.value = Array.isArray(active) ? active[0] || null : active || null;
  } catch {
    recentCycles.value = [];
    activeCycle.value = null;
  } finally {
    loading.value = false;
  }
}

// ===== 工具 =====
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}

onMounted(load);
</script>

<style scoped>
.list-more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  padding: 4px 2px;
  border-radius: 6px;
  white-space: nowrap;
}

.list-more:hover {
  color: var(--brand-gold);
}

.period-body {
  min-height: 90px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px 2px 2px;
}

.p-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.p-tag {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.tag-period { background: rgba(226, 112, 138, 0.14); color: #E2708A; }
.tag-predicted { background: rgba(20, 120, 220, 0.14); color: #1877E0; }
.tag-ovulation { background: rgba(138, 107, 209, 0.16); color: #8A6BD1; }
.tag-safe { background: rgba(78, 154, 119, 0.16); color: #4E9A77; }

.p-bignum {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.p-bignum b {
  font-size: 22px;
  line-height: 1;
  color: #E2708A;
  font-variant-numeric: tabular-nums;
}

.p-bignum i {
  font-style: normal;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.p-sub {
  font-size: 11px;
  color: var(--text-3);
}

.p-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.p-desc {
  font-size: 12px;
  color: var(--text-2);
}

.p-info-row {
  font-size: 12px;
  color: var(--text-2);
}

.p-emoji {
  color: var(--text-3);
  align-self: center;
  margin: 2px 0;
}

.p-progress {
  height: 3px;
  border-radius: 3px;
  background: rgba(226, 112, 138, 0.16);
  overflow: hidden;
}

.p-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: #E2708A;
  transition: width 0.4s ease;
}

.p-progress-caption {
  font-size: 10px;
  color: var(--text-3);
  text-align: right;
  line-height: 1.2;
}

.p-warn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-danger);
}

.p-btn {
  margin-top: 4px;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
  color: #fff;
}

.p-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.p-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-start {
  background: var(--grad-brand);
}

.btn-end {
  background: #1877E0; /* 对齐原型「经期结束」蓝色胶囊 */
}
</style>
