<template>
  <div class="periods-page">
    <!-- 状态卡片（对齐 GUI PeriodHeroCard） -->
    <Panel accent>
      <div class="hero">
        <div class="hero-phase" :class="`phase-${currentPhase}`">
          <div class="hero-icon">{{ phaseEmoji }}</div>
          <div class="hero-info">
            <div class="hero-label">{{ phaseLabel }}</div>
            <div class="hero-detail">{{ phaseDetail }}</div>
          </div>
        </div>
        <div class="hero-actions">
          <el-button v-if="!activeCycle" type="primary" size="small" class="grad-btn" @click="startPeriod">
            开始记录
          </el-button>
          <el-button v-else type="warning" size="small" plain @click="endPeriod">
            结束经期
          </el-button>
        </div>
      </div>
    </Panel>

    <!-- 月份导航 + 日历 -->
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

    <!-- 预测统计卡片（对齐 GUI PeriodPredictionCard） -->
    <Panel title="周期统计" v-if="stats.canPredict">
      <div class="stats-grid">
        <div class="stat-tile">
          <div class="stat-val">{{ stats.avgCycleLength || '-' }}</div>
          <div class="stat-lbl">平均周期</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val">{{ stats.avgPeriodLength || '-' }}</div>
          <div class="stat-lbl">平均经期</div>
        </div>
        <div class="stat-tile highlight">
          <div class="stat-val">{{ stats.nextPeriodDate || '-' }}</div>
          <div class="stat-lbl">下次经期</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val">{{ stats.ovulationDate || '-' }}</div>
          <div class="stat-lbl">排卵日</div>
        </div>
        <div class="stat-tile span2">
          <div class="stat-val">{{ stats.fertileWindow }}</div>
          <div class="stat-lbl">易孕期</div>
        </div>
      </div>
    </Panel>
    <Panel v-else title="周期统计">
      <p class="need-data">需要至少 2 个完整周期才能预测，继续记录吧～</p>
    </Panel>

    <!-- 选中日期的日记录面板 -->
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
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { periodApi } from '@/api';
import Panel from '@/components/Panel.vue';

// ========== 常量（对齐 GUI PeriodConstants） ==========
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
const allCycles = ref<any[]>([]);
const recentCycles = ref<any[]>([]);
const activeCycle = ref<any>(null);
const dailyRecords = ref<any[]>([]);
const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1);
const selectedDate = ref('');
const showDailySheet = ref(false);
const savingDaily = ref(false);

const dailyForm = reactive({
  flowLevel: 'none',
  mood: 'normal',
  symptoms: [] as string[],
  remark: '',
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

const dateTypeMap = computed(() => computeDateTypes([...recentCycles.value, ...allCycles.value]));

function cellClass(cell: { day: number; date: string }) {
  if (!cell.day) return 'empty';
  const t = dateTypeMap.value[cell.date];
  const today = fmtDate(new Date());
  const cls: string[] = [];
  if (t) cls.push(`type-${t}`);
  if (cell.date === today) cls.push('today');
  if (cell.date === selectedDate.value) cls.push('selected');
  return cls.join(' ');
}

// ========== 预测算法（对齐 GUI PeriodPredictionService） ==========
const stats = computed(() => {
  const cycles = allCycles.value.filter((c) => c.startDate).sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
  if (cycles.length === 0) return { canPredict: false, avgCycleLength: 0, avgPeriodLength: 0, nextPeriodDate: '', ovulationDate: '', fertileWindow: '' };

  // 周期长度
  const cycleLengths: number[] = [];
  for (let i = 0; i < cycles.length - 1; i++) {
    const len = daysBetween(cycles[i].startDate, cycles[i + 1].startDate);
    if (len > MIN_CYCLE && len < MAX_CYCLE) cycleLengths.push(len);
  }
  // 经期长度
  const periodLengths: number[] = [];
  for (const c of cycles) {
    if (c.endDate) {
      const len = daysBetween(c.startDate, c.endDate) + 1;
      if (len < 15 && len > 0) periodLengths.push(len);
    }
  }
  // 用户配置的典型值
  let typicalCycle = 0, typicalPeriod = 0;
  for (const c of [...cycles].reverse()) {
    if (!typicalCycle && c.typicalCycleDays >= MIN_CYCLE && c.typicalCycleDays <= MAX_CYCLE) typicalCycle = c.typicalCycleDays;
    if (!typicalPeriod && c.typicalPeriodDays >= 2 && c.typicalPeriodDays <= 14) typicalPeriod = c.typicalPeriodDays;
  }

  const avgCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((s, v) => s + v, 0) / cycleLengths.length) : (typicalCycle || DEFAULT_CYCLE_DAYS);
  const avgPeriod = periodLengths.length ? Math.round(periodLengths.reduce((s, v) => s + v, 0) / periodLengths.length) : (typicalPeriod || DEFAULT_PERIOD_DAYS);
  const canPredict = cycleLengths.length > 0 || typicalCycle > 0;

  const lastStart = cycles[cycles.length - 1].startDate;
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
  };
});

function computeDateTypes(cycles: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  const today = fmtDate(new Date());
  const sorted = cycles.filter((c) => c.startDate).sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
  if (!sorted.length) return result;

  const avgCycle = stats.value.avgCycleLength || DEFAULT_CYCLE_DAYS;
  const avgPeriod = stats.value.avgPeriodLength || DEFAULT_PERIOD_DAYS;

  // 1. 实际经期日
  for (const c of sorted) {
    const end = c.endDate || (c.startDate === sorted[sorted.length - 1]?.startDate && !c.endDate ? today : c.endDate);
    if (end) {
      forEachDate(c.startDate, end, (d) => { result[d] ??= 'period'; });
    } else if (c.startDate <= today) {
      // 活跃周期：从开始到今天
      forEachDate(c.startDate, today, (d) => { result[d] ??= 'period'; });
    }
  }

  // 2. 历史排卵日
  for (let i = 0; i < sorted.length; i++) {
    const nextStart = i < sorted.length - 1 ? sorted[i + 1].startDate : addDays(sorted[i].startDate, avgCycle);
    const ovDay = addDays(nextStart, -LUTEAL_PHASE);
    markOvulationAndFertile(result, ovDay, today);
  }

  // 3. 未来预测
  if (stats.value.canPredict) {
    let predStart = stats.value.nextPeriodDate;
    for (let i = 0; i < PREDICT_ITERATIONS && predStart; i++) {
      const predEnd = addDays(predStart, avgPeriod - 1);
      if (predEnd >= today) {
        forEachDate(predStart, predEnd, (d) => { if (d >= today) result[d] ??= 'predicted'; });
        const pOv = addDays(addDays(predStart, avgCycle), -LUTEAL_PHASE);
        markOvulationAndFertile(result, pOv, today, true);
      }
      predStart = addDays(predStart, avgCycle);
    }
  }

  // 4. 安全期填充
  const earliest = sorted[0]?.startDate || today;
  const latestPred = stats.value.canPredict ? addDays(sorted[sorted.length - 1].startDate, avgCycle * PREDICT_ITERATIONS) : '';
  const fillEnd = latestPred || today;
  forEachDate(earliest <= today ? today : earliest, fillEnd, (d) => { result[d] ??= 'safe'; });

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

// ========== 阶段计算 ==========
const currentPhase = computed<'period' | 'predicted' | 'ovulation' | 'safe' | 'nodata'>(() => {
  if (!stats.value.canPredict) return 'nodata';
  const today = fmtDate(new Date());
  const t = dateTypeMap.value[today];
  if (t === 'period') return 'period';
  if (t === 'predicted') return 'predicted';
  if (t === 'ovulation' || t === 'fertile') return 'ovulation';
  if (t === 'safe') return 'safe';
  return 'nodata';
});

const phaseEmoji = computed(() => ({ period: '🔴', predicted: '🟡', ovulation: '💜', safe: '💚', nodata: '⚪' }[currentPhase.value]));
const phaseLabel = computed(() => ({ period: '经期中', predicted: '预测经期', ovulation: '排卵/易孕期', safe: '安全期', nodata: '开始记录' }[currentPhase.value]));
const phaseDetail = computed(() => {
  const today = fmtDate(new Date());
  if (currentPhase.value === 'period' && activeCycle.value) {
    const day = daysBetween(activeCycle.value.startDate, today) + 1;
    return `第 ${day} 天`;
  }
  if (currentPhase.value === 'predicted') {
    const diff = daysBetween(today, stats.value.nextPeriodDate);
    return diff > 0 ? `${diff} 天后` : '预计已开始';
  }
  if (currentPhase.value === 'ovulation') return '注意避孕或备孕';
  if (currentPhase.value === 'safe') {
    const diff = daysBetween(today, stats.value.nextPeriodDate);
    return `距下次经期 ${diff} 天`;
  }
  return '记录第一个周期';
});

// ========== 操作 ==========
async function startPeriod() {
  const today = fmtDate(new Date());
  try {
    const cycle = await periodApi.createCycle({ startDate: today });
    activeCycle.value = cycle;
    await loadCycles();
    ElMessage.success('已开始记录');
  } catch { ElMessage.error('操作失败'); }
}

async function endPeriod() {
  if (!activeCycle.value) return;
  try {
    const today = fmtDate(new Date());
    await periodApi.updateCycleEnd(activeCycle.value.id, today);
    activeCycle.value = null;
    await loadCycles();
    ElMessage.success('已结束');
  } catch { ElMessage.error('操作失败'); }
}

async function saveDailyRecord() {
  if (!activeCycle.value || !selectedDate.value) return;
  savingDaily.value = true;
  try {
    await periodApi.upsertDailyRecord(activeCycle.value.id, selectedDate.value, {
      flowLevel: dailyForm.flowLevel,
      mood: dailyForm.mood,
      symptoms: JSON.stringify(dailyForm.symptoms),
      remark: dailyForm.remark || undefined,
    });
    showDailySheet.value = false;
    ElMessage.success('已保存');
  } catch { ElMessage.error('保存失败'); }
  finally { savingDaily.value = false; }
}

function selectDate(date: string) {
  const today = fmtDate(new Date());
  if (date > today) { ElMessage.info('未来日期暂不支持'); return; }
  selectedDate.value = date;
  // 如果当前有活跃周期且日期在周期范围内，打开日记录
  if (activeCycle.value && date >= activeCycle.value.startDate && date <= today) {
    loadDailyRecord(date);
  }
}

async function loadDailyRecord(date: string) {
  if (!activeCycle.value) return;
  try {
    const records: any = await periodApi.listDailyRecords(activeCycle.value.id);
    const list = Array.isArray(records) ? records : records?.items || [];
    const rec = list.find((r: any) => r.recordDate === date);
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
  } catch { showDailySheet.value = true; }
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
async function loadCycles() {
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

watch([calYear, calMonth], loadCycles);
onMounted(loadCycles);
</script>

<style scoped>
.periods-page { max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; padding-bottom: 20px; }

/* Hero card */
.hero { display: flex; align-items: center; justify-content: space-between; padding: 18px 16px; }
.hero-phase { display: flex; align-items: center; gap: 14px; }
.hero-icon { font-size: 32px; }
.hero-label { font-size: 16px; font-weight: 700; color: var(--text-1); }
.hero-detail { font-size: 13px; color: var(--text-3); margin-top: 2px; }
.grad-btn { background: var(--grad-brand); border: none; font-weight: 600; }

/* Calendar */
.cal-header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 12px; }
.cal-nav { border: none; background: transparent; font-size: 18px; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 8px; }
.cal-nav:hover { background: var(--surface-hover); }
.cal-title { font-size: 16px; font-weight: 700; color: var(--text-1); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 6px; }
.cal-dow { font-size: 11px; color: var(--text-3); font-weight: 500; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-cell { aspect-ratio: 1; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
.cal-cell.empty { cursor: default; }
.cal-cell.today { box-shadow: inset 0 0 0 1.5px var(--brand-primary); }
.cal-cell.selected { background: var(--brand-primary) !important; }
.cal-cell.selected .cal-day { color: #fff !important; }
.cal-day { font-size: 13px; font-weight: 500; color: var(--text-2); }

/* Date type colors (对齐 GUI PeriodPalette) */
.cal-cell.type-period { background: #FDE9EF; }
.cal-cell.type-period .cal-day { color: #D9536F; font-weight: 600; }
.cal-cell.type-predicted { border: 1.5px dashed rgba(217, 83, 111, 0.4); }
.cal-cell.type-predicted .cal-day { color: #D9536F; }
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

.cal-legend { display: flex; justify-content: center; gap: 14px; margin-top: 12px; }
.leg { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-3); }
.dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.dot-period { background: #FDE9EF; border: 1px solid #D9536F; }
.dot-predicted { border: 1.5px dashed #D9536F; }
.dot-ovulation { background: #F0EAFB; border: 1px solid #8A6BD1; }
.dot-safe { background: #E9F4ED; border: 1px solid #4E9A77; }

/* Stats grid */
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 4px 0; }
.stat-tile { text-align: center; padding: 10px 4px; border-radius: var(--radius-md); background: var(--surface-active); }
.stat-tile.highlight { background: rgba(20, 184, 166, 0.08); border: 1px solid rgba(20, 184, 166, 0.2); }
.stat-tile.span2 { grid-column: span 2; }
.stat-val { font-size: 14px; font-weight: 700; color: var(--text-1); }
.stat-lbl { font-size: 11px; color: var(--text-3); margin-top: 4px; }
.need-data { text-align: center; font-size: 13px; color: var(--text-3); padding: 12px 0; margin: 0; }

/* Bottom sheet */
.sheet-mask { position: fixed; inset: 0; z-index: 3000; background: rgba(4, 8, 18, 0.45); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 480px; background: var(--surface-glass-strong); backdrop-filter: var(--blur-glass); border: 1px solid var(--border-glass); border-radius: 20px 20px 0 0; padding: 10px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: var(--shadow-pop); }
.sheet-bar { width: 36px; height: 4px; border-radius: 2px; background: var(--text-3); opacity: 0.4; margin: 4px auto 14px; }
.sheet-title { font-size: 16px; font-weight: 700; color: var(--text-1); margin-bottom: 16px; }
.sheet-actions { margin-top: 16px; }
.field-group { margin-bottom: 14px; }
.field-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.flow-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.flow-btn { border: 1px solid var(--border-glass); background: var(--surface-glass); padding: 6px 14px; border-radius: 999px; font-size: 13px; color: var(--text-2); cursor: pointer; transition: all 0.15s ease; }
.flow-btn.on { background: var(--grad-brand); color: var(--on-primary); border-color: transparent; font-weight: 600; }
.symptom-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.symptom-chip { border: 1px solid var(--border-glass); background: var(--surface-glass); padding: 5px 12px; border-radius: 999px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all 0.15s ease; }
.symptom-chip.on { background: rgba(20, 184, 166, 0.12); color: var(--brand-primary); border-color: var(--brand-primary); font-weight: 600; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.22s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
