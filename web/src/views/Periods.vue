<template>
  <div class="periods-page">
    <!-- ===== Hero 状态卡（对齐 GUI PeriodHeroCard：6 种阶段视觉） ===== -->
    <!-- 经期中 -->
    <div v-if="currentPhase === 'period'" class="hero-card hero-period">
      <div class="hero-top">
        <span class="hero-tag tag-period">经期中</span>
        <span class="hero-bignum">
          <b>{{ periodDay }}</b>
          <span class="hero-day-suffix">第 {{ periodDay }} 天</span>
        </span>
      </div>
      <div class="hero-sub" v-if="activeCycle?.startDate">开始于 {{ activeCycle.startDate }}</div>
      <div class="hero-progress">
        <div class="hero-progress-fill" :style="{ width: periodProgress + '%' }"></div>
      </div>
      <div class="hero-progress-caption">第 {{ periodDay }} 天 / 平均 {{ stats.avgPeriodLength || 5 }} 天</div>
      <div v-if="periodDay > (stats.avgPeriodLength || 5)" class="hero-warn">
        <el-icon :size="14"><WarningFilled /></el-icon>
        <span>已超过平均经期 {{ (stats.avgPeriodLength || 5) }} 天，记得及时结束记录</span>
      </div>
    </div>

    <!-- 预测经期 -->
    <div v-else-if="currentPhase === 'predicted'" class="hero-card hero-predicted">
      <span class="hero-tag tag-predicted">即将到来</span>
      <div class="hero-title">{{ predictedDueText }}</div>
      <div class="hero-desc">经期预测基于你最近的周期记录，若已开始请点击下方按钮</div>
      <button class="hero-btn" @click="confirmStartToday">标记开始</button>
    </div>

    <!-- 排卵期 -->
    <div v-else-if="currentPhase === 'ovulation'" class="hero-card hero-ovulation">
      <span class="hero-tag tag-ovulation">🥚 排卵</span>
      <div class="hero-title">易孕期</div>
      <div class="hero-info-row">排卵日 {{ stats.ovulationDate || '-' }}</div>
      <div class="hero-info-row">易孕期 {{ stats.fertileWindow || '-' }}</div>
      <div class="hero-desc">距下次经期 {{ daysUntilNext }} 天</div>
    </div>

    <!-- 安全期 -->
    <div v-else-if="currentPhase === 'safe'" class="hero-card hero-safe">
      <span class="hero-tag tag-safe">✿ 安全</span>
      <div class="hero-title">低风险期</div>
      <div class="hero-info-row">距下次经期 {{ daysUntilNext }} 天</div>
      <div class="hero-info-row" v-if="stats.ovulationDate">排卵日 {{ stats.ovulationDate }}</div>
      <div class="hero-info-row" v-if="stats.nextPeriodDate">预计 {{ stats.nextPeriodDate }}</div>
      <div v-if="overdueDays" class="hero-warn">
        <el-icon :size="14"><WarningFilled /></el-icon>
        <span>预测经期已过 {{ overdueDays }} 天仍未记录，是否已开始？</span>
      </div>
    </div>

    <!-- 有记录但数据不足 -->
    <div v-else-if="currentPhase === 'needmore'" class="hero-card hero-needmore">
      <el-icon :size="30" class="hero-emoji"><DataAnalysis /></el-icon>
      <div class="hero-title">继续记录，解锁预测</div>
      <div class="hero-desc">至少需要 2 个完整周期才能预测，当前已有 {{ cycleCount }} 个周期</div>
    </div>

    <!-- 无数据 -->
    <div v-else class="hero-card hero-nodata">
      <el-icon :size="32" class="hero-emoji"><Watermelon /></el-icon>
      <div class="hero-title">记录你的第一个经期</div>
      <div class="hero-desc">点击下方按钮开始记录，之后可随时补记历史周期</div>
      <button class="hero-btn" @click="confirmStartToday">标记开始</button>
    </div>

    <!-- ===== 月份导航 + 日历 ===== -->
    <Panel>
      <div class="cal-header">
        <button class="cal-nav" @click="prevMonth"><el-icon><ArrowLeft /></el-icon></button>
        <span class="cal-title">{{ calYear }}年{{ calMonth }}月</span>
        <button class="cal-nav" @click="nextMonth"><el-icon><ArrowRight /></el-icon></button>
      </div>
      <div class="cal-weekdays">
        <span v-for="d in ['一','二','三','四','五','六','日']" :key="d" class="cal-dow">{{ d }}</span>
      </div>
      <div class="cal-grid">
        <div v-for="(cell, i) in calendarCells" :key="i"
          class="cal-cell" :class="cellClass(cell)"
          @click="cell.date && selectDate(cell.date)">
          <span v-if="cell.day" class="cal-day">{{ cell.day }}</span>
        </div>
      </div>
      <div class="cal-legend">
        <span class="leg"><i class="dot dot-period"></i>经期</span>
        <span class="leg"><i class="dot dot-predicted"></i>预测</span>
        <span class="leg"><i class="dot dot-ovulation"></i>排卵</span>
        <span class="leg"><i class="dot dot-safe"></i>安全</span>
      </div>
    </Panel>

    <!-- ===== 预测统计卡片（对齐 GUI PeriodPredictionCard：2x2 紧凑 tile + 易孕期通栏） ===== -->
    <Panel title="周期统计" v-if="stats.canPredict">
      <div class="pred-grid">
        <div class="pred-tile tile-teal">
          <el-icon :size="15"><Refresh /></el-icon>
          <span class="pred-label">平均周期</span>
          <span class="pred-val">{{ stats.avgCycleLength || '-' }}<i class="pred-unit"> 天</i></span>
        </div>
        <div class="pred-tile tile-pink">
          <el-icon :size="15"><Watermelon /></el-icon>
          <span class="pred-label">平均经期</span>
          <span class="pred-val">{{ stats.avgPeriodLength || '-' }}<i class="pred-unit"> 天</i></span>
        </div>
        <div class="pred-tile tile-purple">
          <el-icon :size="15"><Calendar /></el-icon>
          <span class="pred-label">下次经期</span>
          <span class="pred-val">{{ shortDate(stats.nextPeriodDate) || '-' }}</span>
        </div>
        <div class="pred-tile tile-purple">
          <el-icon :size="15"><Sunny /></el-icon>
          <span class="pred-label">排卵日</span>
          <span class="pred-val">{{ shortDate(stats.ovulationDate) || '-' }}</span>
        </div>
        <div v-if="stats.fertileWindow" class="pred-tile pred-wide tile-pink">
          <el-icon :size="15"><StarFilled /></el-icon>
          <span class="pred-label">易孕期</span>
          <span class="pred-val">{{ shortRange(stats.fertileWindow) }}</span>
        </div>
      </div>
    </Panel>
    <Panel v-else title="周期统计">
      <div class="pred-empty">
        <el-icon :size="20"><DataAnalysis /></el-icon>
        <span>需要至少 2 个完整周期才能预测，继续记录吧～</span>
      </div>
    </Panel>

    <!-- ===== 底部操作面板（选中日期后出现，对齐 GUI） ===== -->
    <!-- ===== 选中日期操作抽屉（对齐 GUI 底部弹出交互，无需下翻） ===== -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="selectedDate" class="sheet-mask" @click.self="selectedDate = ''">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="bp-header">
              <el-icon :size="15"><Calendar /></el-icon>
              <span class="bp-date">{{ selectedDate }}</span>
              <span v-if="dailyRecordOfSelected" class="bp-has-record">已记录</span>
              <span class="bp-close" @click="selectedDate = ''"><el-icon><Close /></el-icon></span>
            </div>

            <!-- 属于某周期：查看/编辑每日明细 + 结束 + 删除 -->
            <template v-if="cycleOfSelected">
              <button class="bp-btn bp-btn-primary" @click="openDailySheet">
                <el-icon :size="16"><EditPen /></el-icon>
                {{ dailyRecordOfSelected ? '编辑每日记录' : '添加每日记录' }}
              </button>
              <button v-if="isInActiveCycle(selectedDate)" class="bp-btn bp-btn-danger" :disabled="operating" @click="confirmEndPeriod">
                <el-icon :size="16"><VideoPause /></el-icon>
                结束经期
              </button>
              <div class="bp-delete-row">
                <button v-if="dailyRecordOfSelected" class="bp-btn bp-btn-outline-danger" :disabled="operating" @click="confirmDeleteDaily">
                  <el-icon :size="16"><Delete /></el-icon>
                  删除当日记录
                </button>
                <button class="bp-btn bp-btn-outline-danger" :disabled="operating" @click="confirmDeleteCycle">
                  <el-icon :size="16"><DeleteFilled /></el-icon>
                  删除周期
                  <span class="bp-btn-sub">{{ cycleOfSelected.startDate }} ~ {{ cycleOfSelected.endDate || '进行中' }}</span>
                </button>
              </div>
            </template>

            <!-- 今天且不在任何周期：标记开始 -->
            <button v-else-if="selectedDate === todayStr" class="bp-btn bp-btn-primary" :disabled="operating" @click="confirmStartPeriod">
              <el-icon :size="16"><VideoPlay /></el-icon>
              标记经期开始
            </button>

            <!-- 历史空白日：补记 -->
            <button v-else class="bp-btn bp-btn-primary" :disabled="operating" @click="openBackfill">
              <el-icon :size="16"><Edit /></el-icon>
              补记经期
            </button>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ===== 补记弹层（对齐 GUI PeriodBackfillSheet） ===== -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="showBackfill" class="sheet-mask" @click.self="showBackfill = false">
          <div class="sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">补记经期</div>
            <p class="sheet-desc">选择历史经期的开始与结束日期（历史记录不允许"进行中"）</p>
            <div class="field-group">
              <label class="field-label">开始日期</label>
              <el-date-picker v-model="backfill.start" type="date" value-format="YYYY-MM-DD"
                :disabled-date="(d) => d.getTime() > Date.now()" class="bp-date-picker" placeholder="选择开始日期" />
            </div>
            <div class="field-group">
              <label class="field-label">结束日期</label>
              <el-date-picker v-model="backfill.end" type="date" value-format="YYYY-MM-DD"
                :disabled-date="(d) => d.getTime() > Date.now() || (backfill.start && d.getTime() < new Date(backfill.start).getTime())"
                class="bp-date-picker" placeholder="选择结束日期" />
            </div>
            <div class="sheet-actions">
              <el-button @click="showBackfill = false">取消</el-button>
              <el-button type="primary" class="grad-btn" :disabled="!backfill.start || !backfill.end" :loading="savingBackfill" @click="saveBackfill">
                确认
              </el-button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ===== 每日明细弹层（对齐 GUI PeriodDailyDetailSheet） ===== -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="showDailySheet" class="sheet-mask" @click.self="showDailySheet = false">
          <div class="sheet daily-sheet">
            <div class="sheet-bar"></div>
            <div class="sheet-title">{{ selectedDate }} 经期记录</div>

            <div class="field-group">
              <label class="field-label">流量</label>
              <div class="flow-btns">
                <button v-for="f in flowLevels" :key="f.value" class="flow-btn" :class="{ on: dailyForm.flowLevel === f.value }" @click="dailyForm.flowLevel = f.value">
                  {{ f.label }}
                </button>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">心情</label>
              <div class="flow-btns">
                <button v-for="m in moods" :key="m.value" class="flow-btn" :class="{ on: dailyForm.mood === m.value }" @click="dailyForm.mood = m.value">
                  {{ m.emoji }} {{ m.label }}
                </button>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">症状</label>
              <div class="symptom-chips">
                <button v-for="s in symptoms" :key="s.value" class="symptom-chip" :class="{ on: dailyForm.symptoms.includes(s.value) }" @click="toggleSymptom(s.value)">
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">备注</label>
              <el-input v-model="dailyForm.remark" type="textarea" :rows="2" placeholder="可选备注..." />
            </div>

            <div class="sheet-actions">
              <el-button type="primary" class="grad-btn" :loading="savingDaily" @click="saveDailyRecord">保存</el-button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, reactive } from 'vue';
import {
  ArrowLeft, ArrowRight, Calendar, Close, EditPen, Edit, VideoPlay, VideoPause,
  Delete, DeleteFilled, WarningFilled, DataAnalysis, Watermelon,
  Refresh, Sunny, StarFilled,
} from '@element-plus/icons-vue';
import { periodApi } from '@/api';
import Panel from '@/components/Panel.vue';

// ========== 常量（对齐 GUI PeriodConstants / PeriodCalcUtil） ==========
const LUTEAL_PHASE = 14;
const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;
const DEFAULT_PERIOD_DAYS = 5;
const DEFAULT_CYCLE_DAYS = 28;
const MIN_CYCLE = 15, MAX_CYCLE = 60;
const PREDICT_ITERATIONS = 6;

const flowLevels = [
  { value: 'none', label: '无' }, { value: 'light', label: '少量' },
  { value: 'medium', label: '中等' }, { value: 'heavy', label: '大量' },
];
const moods = [
  { value: 'good', emoji: '😊', label: '好' }, { value: 'normal', emoji: '😐', label: '一般' },
  { value: 'bad', emoji: '😞', label: '差' }, { value: 'terrible', emoji: '😣', label: '很差' },
];
const symptoms = [
  { value: 'cramps', label: '腹痛' }, { value: 'headache', label: '头痛' },
  { value: 'backache', label: '腰痛' }, { value: 'bloating', label: '腹胀' },
  { value: 'breast_tenderness', label: '胸胀' }, { value: 'fatigue', label: '疲劳' },
  { value: 'insomnia', label: '失眠' }, { value: 'acne', label: '痘痘' },
  { value: 'nausea', label: '恶心' }, { value: 'appetite_change', label: '食欲变化' },
  { value: 'dizziness', label: '头晕' }, { value: 'mood_swings', label: '情绪波动' },
];

// ========== 状态 ==========
const allCycles = ref<any[]>([]);       // 当前月份周期
const recentCycles = ref<any[]>([]);    // 近 60 天周期（含活跃）
const activeCycle = ref<any>(null);
const cycleDailyRecords = ref<Record<string, any[]>>({}); // cycleId -> records
const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1);
const selectedDate = ref('');
const showDailySheet = ref(false);
const savingDaily = ref(false);
const operating = ref(false);
const showBackfill = ref(false);
const savingBackfill = ref(false);
const backfill = reactive({ start: '', end: '' });

const dailyForm = reactive({
  flowLevel: 'none',
  mood: 'normal',
  symptoms: [] as string[],
  remark: '',
});

const todayStr = fmtDate(new Date());

// 合并后的完整周期列表（近 60 天 + 当月，去重）
const cycles = computed(() => {
  const map = new Map<string, any>();
  for (const c of recentCycles.value) map.set(c.id, c);
  for (const c of allCycles.value) map.set(c.id, c);
  return [...map.values()];
});

/** 当前日期所属的周期（对齐 GUI findCycleForDate） */
function findCycleForDate(date: string) {
  return cycles.value.find((c) => date >= c.startDate && (!c.endDate || date <= c.endDate)) || null;
}
const cycleOfSelected = computed(() => (selectedDate.value ? findCycleForDate(selectedDate.value) : null));

/** 选中日期的每日记录（对齐 GUI getDailyRecordByDate） */
const dailyRecordOfSelected = computed(() => {
  const c = cycleOfSelected.value;
  if (!c || !selectedDate.value) return null;
  const list = cycleDailyRecords.value[c.id] || [];
  return list.find((r) => r.recordDate === selectedDate.value) || null;
});

// ========== 日历 ==========
const calendarCells = computed(() => {
  const y = calYear.value, m = calMonth.value;
  const firstDow = new Date(y, m - 1, 1).getDay() || 7; // Mon=1
  const lastDay = new Date(y, m, 0).getDate();
  const cells: { day: number; date: string }[] = [];
  for (let i = 1; i < firstDow; i++) cells.push({ day: 0, date: '' });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, date: `${y}-${pad(m)}-${pad(d)}` });
  }
  return cells;
});

const dateTypeMap = computed(() => computeDateTypes(cycles.value));

function cellClass(cell: { day: number; date: string }) {
  if (!cell.day) return 'empty';
  const t = dateTypeMap.value[cell.date];
  const cls: string[] = [];
  if (t) cls.push(`type-${t}`);
  if (cell.date === todayStr) cls.push('today');
  if (cell.date === selectedDate.value) cls.push('selected');
  return cls.join(' ');
}

// ========== 预测算法（对齐 GUI PeriodPredictionService） ==========
const stats = computed(() => {
  const sorted = cycles.value.filter((c) => c.startDate).sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) return { canPredict: false, avgCycleLength: 0, avgPeriodLength: 0, nextPeriodDate: '', ovulationDate: '', fertileWindow: '' };

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

function computeDateTypes(cycleList: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  const sorted = cycleList.filter((c) => c.startDate).sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) return result;

  const avgCycle = stats.value.avgCycleLength || DEFAULT_CYCLE_DAYS;
  const avgPeriod = stats.value.avgPeriodLength || DEFAULT_PERIOD_DAYS;

  // 1. 实际经期日
  for (const c of sorted) {
    const end = c.endDate || (c.startDate === sorted[sorted.length - 1]?.startDate && !c.endDate ? todayStr : c.endDate);
    if (end) {
      forEachDate(c.startDate, end, (d) => { result[d] ??= 'period'; });
    } else if (c.startDate <= todayStr) {
      forEachDate(c.startDate, todayStr, (d) => { result[d] ??= 'period'; });
    }
  }

  // 2. 历史排卵日
  for (let i = 0; i < sorted.length; i++) {
    const nextStart = i < sorted.length - 1 ? sorted[i + 1].startDate : addDays(sorted[i].startDate, avgCycle);
    const ovDay = addDays(nextStart, -LUTEAL_PHASE);
    markOvulationAndFertile(result, ovDay, todayStr);
  }

  // 3. 未来预测
  if (stats.value.canPredict) {
    let predStart = stats.value.nextPeriodDate;
    for (let i = 0; i < PREDICT_ITERATIONS && predStart; i++) {
      const predEnd = addDays(predStart, avgPeriod - 1);
      if (predEnd >= todayStr) {
        forEachDate(predStart, predEnd, (d) => { if (d >= todayStr) result[d] ??= 'predicted'; });
        const pOv = addDays(addDays(predStart, avgCycle), -LUTEAL_PHASE);
        markOvulationAndFertile(result, pOv, todayStr, true);
      }
      predStart = addDays(predStart, avgCycle);
    }
  }

  // 4. 安全期填充
  const earliest = sorted[0]?.startDate || todayStr;
  const latestPred = stats.value.canPredict ? addDays(sorted[sorted.length - 1].startDate, avgCycle * PREDICT_ITERATIONS) : '';
  const fillEnd = latestPred || todayStr;
  forEachDate(earliest <= todayStr ? todayStr : earliest, fillEnd, (d) => { result[d] ??= 'safe'; });

  return result;
}

function markOvulationAndFertile(map: Record<string, string>, ovDay: string, today: string, futureOnly = false) {
  const fertileStart = addDays(ovDay, -FERTILE_BEFORE);
  const fertileEnd = addDays(ovDay, FERTILE_AFTER);
  forEachDate(fertileStart, fertileEnd, (d) => {
    if (futureOnly && d < today) return;
    if (d === ovDay) map[d] ??= 'ovulation';
    else map[d] ??= 'fertile';
  });
}

// ========== 阶段计算（对齐 GUI PeriodCalcUtil.determinePhase） ==========
type Phase = 'period' | 'predicted' | 'ovulation' | 'safe' | 'nodata' | 'needmore';
const currentPhase = computed<Phase>(() => {
  // 1. 经期中（有未结束周期）优先
  if (activeCycle.value) return 'period';
  const hasRecords = cycles.value.length > 0;
  // 2. 有记录但不足以预测
  if (hasRecords && !stats.value.canPredict) return 'needmore';
  // 3. 无数据
  if (!stats.value.canPredict) return 'nodata';
  // 4. 预测经期窗口内
  const next = stats.value.nextPeriodDate;
  if (next) {
    const windowEnd = addDays(next, stats.value.avgPeriodLength - 1);
    if (todayStr >= next && todayStr <= windowEnd) return 'predicted';
  }
  // 5. 易孕窗口
  if (stats.value.fertileWindowStart && stats.value.fertileWindowEnd) {
    if (todayStr >= stats.value.fertileWindowStart && todayStr <= stats.value.fertileWindowEnd) return 'ovulation';
  }
  // 6. 安全期
  return 'safe';
});

const periodDay = computed(() => {
  if (!activeCycle.value) return 1;
  return Math.max(1, daysBetween(activeCycle.value.startDate, todayStr) + 1);
});
const periodProgress = computed(() => {
  const avg = stats.value.avgPeriodLength || DEFAULT_PERIOD_DAYS;
  return Math.min(100, Math.round((periodDay.value / avg) * 100));
});
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
const cycleCount = computed(() => {
  const ends = cycles.value.filter((c) => c.endDate);
  return ends.length + 1;
});

// ========== 底部面板辅助 ==========
function isInActiveCycle(date: string) {
  if (!activeCycle.value) return false;
  return date >= activeCycle.value.startDate && (!activeCycle.value.endDate || date <= activeCycle.value.endDate);
}

async function selectDate(date: string) {
  if (date > todayStr) { ElMessage.info('未来日期暂不支持'); return; }
  selectedDate.value = date;
  // 日期属于某周期时，加载该周期每日明细
  const c = findCycleForDate(date);
  if (c && !cycleDailyRecords.value[c.id]) {
    try {
      const records: any = await periodApi.listDailyRecords(c.id);
      cycleDailyRecords.value[c.id] = Array.isArray(records) ? records : records?.items || [];
    } catch { cycleDailyRecords.value[c.id] = []; }
  }
}

function openDailySheet() {
  const rec = dailyRecordOfSelected.value;
  if (rec) {
    dailyForm.flowLevel = rec.flowLevel || 'none';
    dailyForm.mood = rec.mood || 'normal';
    try { dailyForm.symptoms = JSON.parse(rec.symptoms || '[]'); } catch { dailyForm.symptoms = []; }
    dailyForm.remark = rec.remark || '';
  } else {
    dailyForm.flowLevel = 'none';
    dailyForm.mood = 'normal';
    dailyForm.symptoms = [];
    dailyForm.remark = '';
  }
  showDailySheet.value = true;
}

// ========== 操作 ==========
async function confirmStartPeriod() {
  if (activeCycle.value) {
    const ok = await ElMessageBox.confirm('当前已有进行中的经期，开始新周期将自动结束上一个周期，是否继续？', '确认开始', {
      confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning',
    }).catch(() => false);
    if (!ok) return;
  }
  await doStart(selectedDate.value || todayStr);
}

function confirmStartToday() {
  if (activeCycle.value) {
    ElMessageBox.confirm('当前已有进行中的经期，开始新周期将自动结束上一个周期，是否继续？', '确认开始', {
      confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning',
    }).then(() => doStart(todayStr)).catch(() => {});
    return;
  }
  doStart(todayStr);
}

async function doStart(date: string) {
  operating.value = true;
  try {
    await periodApi.createCycle({ startDate: date });
    ElMessage.success('已开始记录');
    selectedDate.value = '';
    await reloadAll();
  } catch { ElMessage.error('操作失败'); }
  finally { operating.value = false; }
}

async function confirmEndPeriod() {
  const c = cycleOfSelected.value;
  if (!c) return;
  // 结束日期不能早于最后一条明细
  const list = cycleDailyRecords.value[c.id] || [];
  const lastRec = list.length ? list[list.length - 1].recordDate : '';
  if (lastRec && selectedDate.value < lastRec) {
    ElMessage.warning('结束日期不能早于已记录明细的日期');
    return;
  }
  const ok = await ElMessageBox.confirm(
    `确定结束经期吗？\n${c.startDate} → ${selectedDate.value}`, '结束经期', {
      confirmButtonText: '确认结束', cancelButtonText: '取消', type: 'warning',
    },
  ).catch(() => false);
  if (!ok) return;
  operating.value = true;
  try {
    await periodApi.updateCycleEnd(c.id, selectedDate.value);
    ElMessage.success('已结束');
    selectedDate.value = '';
    await reloadAll();
  } catch { ElMessage.error('操作失败'); }
  finally { operating.value = false; }
}

function openBackfill() {
  backfill.start = '';
  backfill.end = '';
  showBackfill.value = true;
}

async function saveBackfill() {
  if (!backfill.start || !backfill.end) return;
  savingBackfill.value = true;
  try {
    await periodApi.createCycle({ startDate: backfill.start, endDate: backfill.end });
    ElMessage.success('补记成功');
    showBackfill.value = false;
    selectedDate.value = '';
    const d = new Date(backfill.start);
    calYear.value = d.getFullYear();
    calMonth.value = d.getMonth() + 1;
    await reloadAll();
  } catch { ElMessage.error('补记失败'); }
  finally { savingBackfill.value = false; }
}

async function saveDailyRecord() {
  const c = cycleOfSelected.value;
  if (!c || !selectedDate.value) return;
  savingDaily.value = true;
  try {
    await periodApi.upsertDailyRecord(c.id, selectedDate.value, {
      flowLevel: dailyForm.flowLevel,
      mood: dailyForm.mood,
      symptoms: JSON.stringify(dailyForm.symptoms),
      remark: dailyForm.remark || undefined,
    });
    showDailySheet.value = false;
    // 刷新该周期明细
    const records: any = await periodApi.listDailyRecords(c.id);
    cycleDailyRecords.value[c.id] = Array.isArray(records) ? records : records?.items || [];
    ElMessage.success('已保存');
  } catch { ElMessage.error('保存失败'); }
  finally { savingDaily.value = false; }
}

async function confirmDeleteDaily() {
  const c = cycleOfSelected.value;
  if (!c || !selectedDate.value) return;
  const ok = await ElMessageBox.confirm('确定删除这条日记录吗？', '删除记录', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  }).catch(() => false);
  if (!ok) return;
  operating.value = true;
  try {
    await periodApi.deleteDailyRecord(c.id, selectedDate.value);
    ElMessage.success('已删除');
    cycleDailyRecords.value[c.id] = (cycleDailyRecords.value[c.id] || []).filter((r) => r.recordDate !== selectedDate.value);
    selectedDate.value = '';
  } catch { ElMessage.error('删除失败'); }
  finally { operating.value = false; }
}

async function confirmDeleteCycle() {
  const c = cycleOfSelected.value;
  if (!c) return;
  const ok = await ElMessageBox.confirm(
    `确定删除整个周期吗？\n${c.startDate} ~ ${c.endDate || '进行中'}（含期间所有每日记录）`, '删除周期', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    },
  ).catch(() => false);
  if (!ok) return;
  operating.value = true;
  try {
    await periodApi.deleteCycle(c.id);
    ElMessage.success('已删除');
    selectedDate.value = '';
    await reloadAll();
  } catch { ElMessage.error('删除失败'); }
  finally { operating.value = false; }
}

function toggleSymptom(val: string) {
  const idx = dailyForm.symptoms.indexOf(val);
  if (idx >= 0) dailyForm.symptoms.splice(idx, 1);
  else dailyForm.symptoms.push(val);
}

function prevMonth() {
  if (calMonth.value === 1) { calYear.value--; calMonth.value = 12; }
  else calMonth.value--;
}
function nextMonth() {
  if (calMonth.value === 12) { calYear.value++; calMonth.value = 1; }
  else calMonth.value++;
}

// ========== 数据加载 ==========
async function reloadAll() {
  try {
    const [monthCycles, recent, active]: any = await Promise.all([
      periodApi.listCycles({ year: calYear.value, month: calMonth.value }),
      periodApi.listCycles({ recent: 60 }),
      periodApi.listCycles({ active: 'true' }),
    ]);
    allCycles.value = Array.isArray(monthCycles) ? monthCycles : [];
    recentCycles.value = Array.isArray(recent) ? recent : [];
    activeCycle.value = Array.isArray(active) ? active[0] || null : active || null;
  } catch { /* ignore */ }
}

// ========== 工具函数 ==========
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** 日期只显示 MM-DD（对齐 GUI substring(5)） */
function shortDate(d: string) { return d && d.length >= 10 ? d.slice(5) : d; }
/** 易孕期范围 "YYYY-MM-DD ~ YYYY-MM-DD" → "MM-DD ~ MM-DD" */
function shortRange(r: string) { return r.split(' ~ ').map(shortDate).join(' ~ '); }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}
function forEachDate(start: string, end: string, fn: (d: string) => void) {
  let d = new Date(start);
  const last = new Date(end);
  while (d <= last) { fn(fmtDate(d)); d.setDate(d.getDate() + 1); }
}

watch([calYear, calMonth], () => {
  selectedDate.value = '';
  reloadAll();
});
onMounted(reloadAll);
</script>

<style scoped>
.periods-page { max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 20px; }

/* ===== Hero 状态卡（对齐 GUI PeriodHeroCard 各阶段渐变） ===== */
.hero-card {
  border-radius: 18px;
  padding: 12px 14px 14px;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hero-period { background: linear-gradient(135deg, rgba(226, 112, 138, 0.16), rgba(226, 112, 138, 0.05)); border-color: rgba(226, 112, 138, 0.32); }
.hero-predicted { background: linear-gradient(135deg, rgba(20, 120, 220, 0.18), rgba(20, 120, 220, 0.06)); border-color: rgba(20, 120, 220, 0.32); }
.hero-ovulation { background: linear-gradient(135deg, rgba(138, 107, 209, 0.22), rgba(138, 107, 209, 0.07)); border-color: rgba(138, 107, 209, 0.38); }
.hero-safe { background: linear-gradient(135deg, rgba(78, 154, 119, 0.2), rgba(78, 154, 119, 0.06)); border-color: rgba(78, 154, 119, 0.35); }
.hero-nodata { background: rgba(15, 23, 42, 0.045); border-color: rgba(15, 23, 42, 0.09); }
.hero-needmore { background: linear-gradient(135deg, rgba(20, 120, 220, 0.14), rgba(20, 120, 220, 0.05)); border-color: rgba(20, 120, 220, 0.28); }

html.dark .hero-nodata { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.1); }

.hero-top { display: flex; align-items: center; justify-content: space-between; }
.hero-tag {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.tag-period { background: rgba(226, 112, 138, 0.14); color: #E2708A; }
.tag-predicted { background: rgba(20, 120, 220, 0.14); color: #1877E0; }
.tag-ovulation { background: rgba(138, 107, 209, 0.16); color: #8A6BD1; }
.tag-safe { background: rgba(78, 154, 119, 0.16); color: #4E9A77; }

.hero-bignum { display: flex; align-items: baseline; gap: 6px; }
.hero-bignum b { font-size: 30px; line-height: 1; color: #E2708A; }
.hero-day-suffix { font-size: 13px; color: var(--text-2); font-weight: 500; }
.hero-sub { font-size: 11px; color: var(--text-3); }

.hero-progress { height: 3px; border-radius: 3px; background: rgba(226, 112, 138, 0.16); overflow: hidden; }
.hero-progress-fill { height: 100%; border-radius: 3px; background: #E2708A; transition: width 0.4s ease; }
.hero-progress-caption { font-size: 10px; color: var(--text-3); text-align: right; line-height: 1.2; }

.hero-warn { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--color-danger); }
.hero-title { font-size: 15px; font-weight: 700; color: var(--text-1); }
.hero-desc { font-size: 12px; color: var(--text-2); }
.hero-info-row { font-size: 12px; color: var(--text-2); }
.hero-emoji { color: var(--text-3); align-self: center; margin: 2px 0; }

.hero-btn {
  margin-top: 2px;
  padding: 9px 0;
  border: none;
  border-radius: 12px;
  background: var(--grad-brand);
  color: var(--on-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.hero-btn:hover { opacity: 0.92; }

/* ===== 日历 ===== */
.cal-header { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 8px; }
.cal-nav { border: none; background: transparent; font-size: 16px; color: var(--text-2); cursor: pointer; padding: 4px; border-radius: 8px; }
.cal-nav:hover { background: var(--surface-hover); }
.cal-title { font-size: 15px; font-weight: 700; color: var(--text-1); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 3px; }
.cal-dow { font-size: 10px; color: var(--text-3); font-weight: 500; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell { aspect-ratio: 1.2; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
.cal-cell.empty { cursor: default; }
.cal-cell.today { box-shadow: inset 0 0 0 1.5px var(--brand-gold); }
.cal-cell.selected { background: var(--brand-gold) !important; }
.cal-cell.selected .cal-day { color: #fff !important; }
.cal-day { font-size: 12px; font-weight: 500; color: var(--text-2); }

.cal-cell.type-period { background: #FDE9EF; }
.cal-cell.type-period .cal-day { color: #E2708A; font-weight: 600; }
.cal-cell.type-predicted { border: 1.5px dashed rgba(226, 112, 138, 0.4); }
.cal-cell.type-predicted .cal-day { color: #E2708A; }
.cal-cell.type-ovulation { background: #F0EAFB; }
.cal-cell.type-ovulation .cal-day { color: #8A6BD1; font-weight: 700; }
.cal-cell.type-fertile { background: #F7F3FD; border: 1px solid rgba(138, 107, 209, 0.2); }
.cal-cell.type-fertile .cal-day { color: #8A6BD1; }
.cal-cell.type-safe { background: #E9F4ED; }
.cal-cell.type-safe .cal-day { color: #4E9A77; }

html.dark .cal-cell.type-period { background: #482230; }
html.dark .cal-cell.type-period .cal-day { color: #F48BA6; }
html.dark .cal-cell.type-predicted { border-color: rgba(244, 139, 166, 0.4); }
html.dark .cal-cell.type-predicted .cal-day { color: #F48BA6; }
html.dark .cal-cell.type-ovulation { background: #362A4B; }
html.dark .cal-cell.type-ovulation .cal-day { color: #C7ABF0; }
html.dark .cal-cell.type-fertile { background: #2E2540; border-color: rgba(199, 171, 240, 0.2); }
html.dark .cal-cell.type-fertile .cal-day { color: #C7ABF0; }
html.dark .cal-cell.type-safe { background: #1F372B; }
html.dark .cal-cell.type-safe .cal-day { color: #8FD0B0; }

.cal-legend { display: flex; justify-content: center; gap: 10px; margin-top: 6px; }
.leg { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-3); }
.dot { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
.dot-period { background: #FDE9EF; border: 1px solid #E2708A; }
.dot-predicted { border: 1.5px dashed #E2708A; }
.dot-ovulation { background: #F0EAFB; border: 1px solid #8A6BD1; }
.dot-safe { background: #E9F4ED; border: 1px solid #4E9A77; }

/* ===== 周期统计（对齐 GUI PeriodPredictionCard：2x2 紧凑 tile + 易孕期通栏） ===== */
.pred-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 2px 0; }
.pred-tile {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid;
}
.pred-tile .el-icon { flex-shrink: 0; }
.tile-teal { background: rgba(20, 184, 166, 0.08); border-color: rgba(20, 184, 166, 0.2); color: #0d9488; }
.tile-pink { background: rgba(226, 112, 138, 0.08); border-color: rgba(226, 112, 138, 0.22); color: #E2708A; }
.tile-purple { background: rgba(138, 107, 209, 0.08); border-color: rgba(138, 107, 209, 0.2); color: #8A6BD1; }
.pred-label {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pred-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  flex-shrink: 0;
}
.pred-unit { font-size: 10px; font-weight: 400; color: var(--text-3); font-style: normal; }
.pred-wide { grid-column: span 2; }
.pred-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  font-size: 13px;
  color: var(--text-3);
}

/* ===== 选中日期操作抽屉（对齐 GUI 底部弹出交互） ===== */
.bp-header { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.bp-date { font-size: 15px; font-weight: 600; color: var(--text-1); }
.bp-has-record { font-size: 12px; color: var(--brand-gold); }
.bp-close { margin-left: auto; cursor: pointer; color: var(--text-3); display: flex; padding: 4px; border-radius: 6px; }
.bp-close:hover { background: var(--surface-hover); color: var(--text-1); }

.bp-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.bp-btn:disabled { opacity: 0.6; cursor: default; }

.bp-btn-primary { background: var(--grad-brand); color: var(--on-primary); }
.bp-btn-danger { background: var(--color-danger); color: #fff; }
.bp-btn-danger:hover:not(:disabled) { background: #dc2626; }

.bp-delete-row { display: flex; gap: 8px; }
.bp-delete-row .bp-btn { flex: 1; }

/* 抽屉内按钮纵向间距（sheet 内无卡片 flex gap，用相邻选择补） */
.sheet > .bp-btn {
  margin-bottom: 8px;
}
.sheet > .bp-btn:last-child,
.sheet .bp-delete-row:last-child {
  margin-bottom: 0;
}
.bp-btn-outline-danger {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.45);
  flex-direction: column;
  gap: 2px;
}
.bp-btn-outline-danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.08); }
.bp-btn-sub { font-size: 10px; font-weight: 400; color: var(--text-3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== 弹层 ===== */
.sheet-mask { position: fixed; inset: 0; z-index: 3000; background: rgba(4, 8, 18, 0.45); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 480px; background: var(--surface-glass-strong); backdrop-filter: var(--blur-glass); border: 1px solid var(--border-glass); border-radius: 20px 20px 0 0; padding: 10px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: var(--shadow-pop); }
.sheet-bar { width: 36px; height: 4px; border-radius: 2px; background: var(--text-3); opacity: 0.4; margin: 4px auto 14px; }
.sheet-title { font-size: 16px; font-weight: 700; color: var(--text-1); margin-bottom: 6px; }
.sheet-desc { font-size: 12px; color: var(--text-3); margin: 0 0 14px; }
.sheet-actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
.sheet-actions .el-button { margin-left: 0; }
.field-group { margin-bottom: 14px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.flow-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.flow-btn { border: 1px solid var(--border-glass); background: var(--surface-glass); padding: 6px 14px; border-radius: 999px; font-size: 13px; color: var(--text-2); cursor: pointer; transition: all 0.15s ease; }
.flow-btn.on { background: var(--grad-brand); color: var(--on-primary); border-color: transparent; font-weight: 600; }
.symptom-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.symptom-chip { border: 1px solid var(--border-glass); background: var(--surface-glass); padding: 5px 12px; border-radius: 999px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all 0.15s ease; }
.symptom-chip.on { background: var(--brand-gold-soft); color: var(--brand-gold); border-color: var(--brand-gold); font-weight: 600; }
.bp-date-picker { width: 100%; }

.grad-btn { background: var(--grad-brand); border: none; font-weight: 600; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.22s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
