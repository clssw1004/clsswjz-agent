/**
 * Period prediction pure functions — ported from GUI's PeriodPredictionService.
 *
 * Provides two entry points:
 *  - `computeStats` : derive cycle statistics (averages, next period, ovulation, fertile window)
 *  - `computeDateTypes` : map calendar dates to semantic types (period, predicted, ovulation, fertile, safe)
 */

/* ---------- constants (mirrors period_constants.dart) ---------- */

export const MIN_CYCLE_LENGTH = 15;
export const MAX_CYCLE_LENGTH = 60;
export const LUTEAL_PHASE_DAYS = 14;
export const FERTILE_WINDOW_BEFORE = 5;
export const FERTILE_WINDOW_AFTER = 1;
export const PREDICT_ITERATIONS = 6;
export const TYPICAL_CYCLE_MIN = 15;
export const TYPICAL_CYCLE_MAX = 60;
export const TYPICAL_PERIOD_MIN = 2;
export const TYPICAL_PERIOD_MAX = 14;

/* ---------- date type enum ---------- */

export const DateType = {
  period: 'period',
  ovulation: 'ovulation',
  fertile: 'fertile',
  safe: 'safe',
  predictedPeriod: 'predictedPeriod',
} as const;

export type DateTypeValue = (typeof DateType)[keyof typeof DateType];

/* ---------- input / output types ---------- */

export interface CycleInput {
  startDate: string;
  endDate?: string | null;
  typicalPeriodDays?: number | null;
  typicalCycleDays?: number | null;
}

export interface PeriodStats {
  averageCycleLength: number;
  averagePeriodLength: number;
  totalRecords: number;
  recentCycleLengths: number[];
  lastPeriodStart: string | null;
  nextPeriodDate: string | null;
  ovulationDate: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  canPredict: boolean;
  typicalCycleDays: number | null;
  typicalPeriodDays: number | null;
}

export const EMPTY_STATS: PeriodStats = {
  averageCycleLength: 0,
  averagePeriodLength: 0,
  totalRecords: 0,
  recentCycleLengths: [],
  lastPeriodStart: null,
  nextPeriodDate: null,
  ovulationDate: null,
  fertileWindowStart: null,
  fertileWindowEnd: null,
  canPredict: false,
  typicalCycleDays: null,
  typicalPeriodDays: null,
};

/* ---------- date helpers ---------- */

export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0);
}

/* ---------- computeStats ---------- */

export function computeStats(cycles: CycleInput[]): PeriodStats {
  if (cycles.length === 0) return { ...EMPTY_STATS };

  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Cycle lengths: diff between consecutive startDate values
  const cycleLengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
    if (diff > MIN_CYCLE_LENGTH && diff < MAX_CYCLE_LENGTH) {
      cycleLengths.push(diff);
    }
  }

  // Period lengths: from completed cycles only
  const periodLengths: number[] = [];
  for (const cycle of sorted) {
    if (cycle.endDate) {
      const days = daysBetween(cycle.startDate, cycle.endDate) + 1;
      if (days > 0 && days < 15) {
        periodLengths.push(days);
      }
    }
  }

  // Extract typical params from the most recent cycle
  let typicalCycle: number | null = null;
  let typicalPeriod: number | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i];
    if (typicalCycle === null && c.typicalCycleDays != null &&
        c.typicalCycleDays >= TYPICAL_CYCLE_MIN && c.typicalCycleDays <= TYPICAL_CYCLE_MAX) {
      typicalCycle = c.typicalCycleDays;
    }
    if (typicalPeriod === null && c.typicalPeriodDays != null &&
        c.typicalPeriodDays >= TYPICAL_PERIOD_MIN && c.typicalPeriodDays <= TYPICAL_PERIOD_MAX) {
      typicalPeriod = c.typicalPeriodDays;
    }
    if (typicalCycle !== null && typicalPeriod !== null) break;
  }

  const hasCycleData = cycleLengths.length > 0;
  const avgCycle = hasCycleData
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : (typicalCycle ?? 28);
  const avgPeriod = periodLengths.length > 0
    ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
    : (typicalPeriod ?? 5);

  const lastStart = sorted[sorted.length - 1].startDate;
  const canPredict = hasCycleData || typicalCycle !== null;

  let nextPeriodDate: string | null = null;
  let ovulationDate: string | null = null;
  let fertileWindowStart: string | null = null;
  let fertileWindowEnd: string | null = null;

  if (canPredict) {
    nextPeriodDate = addDays(lastStart, avgCycle);
    ovulationDate = addDays(nextPeriodDate, -LUTEAL_PHASE_DAYS);
    fertileWindowStart = addDays(ovulationDate, -FERTILE_WINDOW_BEFORE);
    fertileWindowEnd = addDays(ovulationDate, FERTILE_WINDOW_AFTER);
  }

  return {
    averageCycleLength: avgCycle,
    averagePeriodLength: avgPeriod,
    totalRecords: cycles.length,
    recentCycleLengths: cycleLengths,
    lastPeriodStart: lastStart,
    nextPeriodDate,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    canPredict,
    typicalCycleDays: typicalCycle,
    typicalPeriodDays: typicalPeriod,
  };
}

/* ---------- computeDateTypes ---------- */

export function computeDateTypes(
  cycles: CycleInput[],
  stats: PeriodStats | null,
  today?: string,
): Record<string, DateTypeValue> {
  const result: Record<string, DateTypeValue> = {};
  const todayDate = today ?? todayStr();
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // 1. Actual period days
  let activeCycle: CycleInput | null = null;
  for (const cycle of sorted) {
    if (cycle.endDate) {
      let date = cycle.startDate;
      while (date <= cycle.endDate) {
        result[date] = DateType.period;
        date = addDays(date, 1);
      }
    } else {
      activeCycle = cycle;
      let date = cycle.startDate;
      while (date <= todayDate) {
        result[date] = DateType.period;
        date = addDays(date, 1);
      }
    }
  }

  // 1.5 Active cycle expected continuation (today+1 ~ startDate + avgPeriod - 1)
  if (activeCycle && stats && stats.canPredict) {
    const expectEnd = addDays(activeCycle.startDate, stats.averagePeriodLength - 1);
    if (expectEnd > todayDate) {
      let date = addDays(todayDate, 1);
      while (date <= expectEnd) {
        if (!result[date]) result[date] = DateType.predictedPeriod;
        date = addDays(date, 1);
      }
    }
  }

  // 2. Ovulation + fertile window for each actual cycle (retrospective)
  for (let i = 0; i < sorted.length; i++) {
    const cycle = sorted[i];
    let ovulation: string;
    if (i + 1 < sorted.length) {
      ovulation = addDays(sorted[i + 1].startDate, -LUTEAL_PHASE_DAYS);
    } else {
      const avgCycle = stats?.averageCycleLength ?? 28;
      ovulation = addDays(cycle.startDate, avgCycle - LUTEAL_PHASE_DAYS);
    }

    if (!result[ovulation]) result[ovulation] = DateType.ovulation;
    const fStart = addDays(ovulation, -FERTILE_WINDOW_BEFORE);
    const fEnd = addDays(ovulation, FERTILE_WINDOW_AFTER);
    let date = fStart;
    while (date <= fEnd) {
      if (!result[date]) result[date] = DateType.fertile;
      date = addDays(date, 1);
    }
  }

  // 3. Future predictions (multi-cycle iteration)
  let maxPredictedEnd: string | null = null;
  if (stats && stats.canPredict) {
    let predStart = stats.nextPeriodDate;
    let iterations = 0;
    while (predStart !== null && iterations < PREDICT_ITERATIONS) {
      const windowEnd = addDays(predStart, stats.averagePeriodLength - 1);
      if (windowEnd >= todayDate) {
        // Mark predicted period days
        for (let i = 0; i < stats.averagePeriodLength; i++) {
          const date = addDays(predStart, i);
          if (date >= todayDate && !result[date]) {
            result[date] = DateType.predictedPeriod;
          }
        }
        // Ovulation (only future)
        const ovulation = addDays(predStart, -LUTEAL_PHASE_DAYS);
        if (ovulation >= todayDate && !result[ovulation]) {
          result[ovulation] = DateType.ovulation;
        }
        // Fertile window (only future)
        const fStart = addDays(ovulation, -FERTILE_WINDOW_BEFORE);
        const fEnd = addDays(ovulation, FERTILE_WINDOW_AFTER);
        let date = fStart;
        while (date <= fEnd) {
          if (date >= todayDate && !result[date]) {
            result[date] = DateType.fertile;
          }
          date = addDays(date, 1);
        }
      }
      maxPredictedEnd = windowEnd;
      iterations++;
      if (iterations >= PREDICT_ITERATIONS) break;
      predStart = addDays(predStart, stats.averageCycleLength);
    }
  }

  // 4. Safe days: fill unmarked dates from safeStart to maxPredictedEnd
  if (stats && stats.canPredict && maxPredictedEnd) {
    let safeStart: string;
    if (activeCycle) {
      const expectEnd = addDays(activeCycle.startDate, stats.averagePeriodLength - 1);
      safeStart = expectEnd >= todayDate ? addDays(expectEnd, 1) : todayDate;
    } else {
      safeStart = sorted.length > 0 ? sorted[0].startDate : todayDate;
    }
    let date = safeStart;
    while (date <= maxPredictedEnd) {
      if (!result[date]) result[date] = DateType.safe;
      date = addDays(date, 1);
    }
  }

  return result;
}
