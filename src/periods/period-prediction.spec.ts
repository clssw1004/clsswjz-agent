import {
  computeStats,
  computeDateTypes,
  DateType,
  CycleInput,
  PeriodStats,
  EMPTY_STATS,
} from './period-prediction';

function makeCycle(
  startDate: string,
  opts: { endDate?: string; typicalPeriodDays?: number; typicalCycleDays?: number } = {},
): CycleInput {
  return {
    startDate,
    endDate: opts.endDate ?? null,
    typicalPeriodDays: opts.typicalPeriodDays ?? null,
    typicalCycleDays: opts.typicalCycleDays ?? null,
  };
}

describe('computeStats', () => {
  describe('empty cycles', () => {
    it('returns empty stats with canPredict=false', () => {
      const result = computeStats([]);
      expect(result.canPredict).toBe(false);
      expect(result.totalRecords).toBe(0);
      expect(result).toEqual(EMPTY_STATS);
    });
  });

  describe('single cycle', () => {
    it('no prediction without typical params', () => {
      const cycles = [makeCycle('2026-08-01', { endDate: '2026-08-05' })];
      const result = computeStats(cycles);
      expect(result.canPredict).toBe(false);
      expect(result.averagePeriodLength).toBe(5);
      expect(result.lastPeriodStart).toBe('2026-08-01');
    });

    it('can predict with typical params', () => {
      const cycles = [
        makeCycle('2026-08-01', { endDate: '2026-08-05', typicalPeriodDays: 5, typicalCycleDays: 28 }),
      ];
      const result = computeStats(cycles);
      expect(result.canPredict).toBe(true);
      expect(result.averageCycleLength).toBe(28);
      expect(result.averagePeriodLength).toBe(5);
      // next = Aug 1 + 28 = Aug 29
      expect(result.nextPeriodDate).toBe('2026-08-29');
      // ovulation = Aug 29 - 14 = Aug 15
      expect(result.ovulationDate).toBe('2026-08-15');
    });

    it('invalid typical params are ignored', () => {
      const cycles = [
        makeCycle('2026-08-01', { endDate: '2026-08-05', typicalCycleDays: 3, typicalPeriodDays: 100 }),
      ];
      const result = computeStats(cycles);
      expect(result.canPredict).toBe(false);
      expect(result.averageCycleLength).toBe(28); // default fallback
    });
  });

  describe('two cycles', () => {
    it('can predict with correct averages', () => {
      const cycles = [
        makeCycle('2026-08-01', { endDate: '2026-08-05' }),
        makeCycle('2026-08-29', { endDate: '2026-09-02' }),
      ];
      const result = computeStats(cycles);
      expect(result.canPredict).toBe(true);
      expect(result.recentCycleLengths).toEqual([28]);
      expect(result.averageCycleLength).toBe(28);
    });
  });

  describe('three cycles', () => {
    it('predicts correctly with 28-day cycles', () => {
      const cycles = [
        makeCycle('2026-07-04', { endDate: '2026-07-08' }),
        makeCycle('2026-08-01', { endDate: '2026-08-05' }),
        makeCycle('2026-08-29', { endDate: '2026-09-02' }),
      ];
      const result = computeStats(cycles);
      expect(result.canPredict).toBe(true);
      expect(result.recentCycleLengths).toEqual([28, 28]);
      expect(result.averageCycleLength).toBe(28);
      expect(result.averagePeriodLength).toBe(5);
      // lastPeriodStart = Aug 29, next = Aug 29 + 28 = Sep 26
      expect(result.nextPeriodDate).toBe('2026-09-26');
      // ovulation = Sep 26 - 14 = Sep 12
      expect(result.ovulationDate).toBe('2026-09-12');
      // fertile = [Sep 7, Sep 13]
      expect(result.fertileWindowStart).toBe('2026-09-07');
      expect(result.fertileWindowEnd).toBe('2026-09-13');
    });
  });

  describe('anomalous cycle lengths', () => {
    it('filters out cycles shorter than 15 days or longer than 60 days', () => {
      const cycles = [
        makeCycle('2026-06-01', { endDate: '2026-06-03' }),
        makeCycle('2026-06-06', { endDate: '2026-06-08' }), // 3-day gap (anomalous)
        makeCycle('2026-07-04', { endDate: '2026-07-06' }), // 28-day gap
        makeCycle('2026-08-01', { endDate: '2026-08-03' }), // 28-day gap
      ];
      const result = computeStats(cycles);
      expect(result.recentCycleLengths).toEqual([28, 28]);
      expect(result.canPredict).toBe(true);
    });
  });

  describe('typical params ignored when history exists', () => {
    it('historical data takes priority over typical params', () => {
      const cycles = [
        makeCycle('2026-07-04', { endDate: '2026-07-08', typicalCycleDays: 35, typicalPeriodDays: 7 }),
        makeCycle('2026-08-01', { endDate: '2026-08-05', typicalCycleDays: 35, typicalPeriodDays: 7 }),
      ];
      const result = computeStats(cycles);
      expect(result.recentCycleLengths).toEqual([28]);
      expect(result.averageCycleLength).toBe(28);
      expect(result.averagePeriodLength).toBe(5);
    });
  });
});

describe('computeDateTypes', () => {
  describe('period days', () => {
    it('marks period days from completed cycles', () => {
      const cycles = [makeCycle('2026-08-10', { endDate: '2026-08-12' })];
      const types = computeDateTypes(cycles, null);
      expect(types['2026-08-10']).toBe(DateType.period);
      expect(types['2026-08-11']).toBe(DateType.period);
      expect(types['2026-08-12']).toBe(DateType.period);
      expect(types['2026-08-13']).toBeUndefined();
    });

    it('marks active cycle period days through today', () => {
      const cycles = [makeCycle('2026-08-10')]; // no endDate = active
      const types = computeDateTypes(cycles, null, '2026-08-11');
      expect(types['2026-08-10']).toBe(DateType.period);
      expect(types['2026-08-11']).toBe(DateType.period);
    });
  });

  describe('predicted and ovulation', () => {
    it('marks period days from actual cycles', () => {
      const cycles = [
        makeCycle('2026-08-01', { endDate: '2026-08-05' }),
        makeCycle('2026-08-29', { endDate: '2026-09-02' }),
      ];
      const stats = computeStats(cycles);
      const types = computeDateTypes(cycles, stats);
      expect(types['2026-08-01']).toBe(DateType.period);
      expect(types['2026-08-29']).toBe(DateType.period);
    });
  });

  describe('multi-cycle future prediction', () => {
    it('iterates predictions across multiple future cycles', () => {
      const stats: PeriodStats = {
        averageCycleLength: 28,
        averagePeriodLength: 5,
        totalRecords: 0,
        recentCycleLengths: [28, 28],
        lastPeriodStart: null,
        nextPeriodDate: '2026-09-01',
        ovulationDate: '2026-08-18',
        fertileWindowStart: '2026-08-13',
        fertileWindowEnd: '2026-08-19',
        canPredict: true,
        typicalCycleDays: null,
        typicalPeriodDays: null,
      };
      const types = computeDateTypes([], stats, '2026-08-19');
      // Round 1: 09-01 ~ 09-05
      expect(types['2026-09-01']).toBe(DateType.predictedPeriod);
      expect(types['2026-09-05']).toBe(DateType.predictedPeriod);
      // Round 2: 09-29 ~ 10-03
      expect(types['2026-09-29']).toBe(DateType.predictedPeriod);
      expect(types['2026-10-03']).toBe(DateType.predictedPeriod);
      // Round 3: 10-27 ~ 10-31
      expect(types['2026-10-27']).toBe(DateType.predictedPeriod);
      // Ovulation + fertile (round 2)
      expect(types['2026-09-15']).toBe(DateType.ovulation);
      expect(types['2026-09-10']).toBe(DateType.fertile);
    });
  });

  describe('safe day fill', () => {
    it('marks safe days between today and farthest prediction', () => {
      const stats: PeriodStats = {
        averageCycleLength: 28,
        averagePeriodLength: 5,
        totalRecords: 0,
        recentCycleLengths: [28, 28],
        lastPeriodStart: null,
        nextPeriodDate: '2026-09-01',
        ovulationDate: '2026-08-18',
        fertileWindowStart: '2026-08-13',
        fertileWindowEnd: '2026-08-19',
        canPredict: true,
        typicalCycleDays: null,
        typicalPeriodDays: null,
      };
      const types = computeDateTypes([], stats, '2026-08-05');
      // Safe days (not overwritten by special types)
      expect(types['2026-08-05']).toBe(DateType.safe);
      expect(types['2026-08-10']).toBe(DateType.safe);
      // Fertile window is not overwritten
      expect(types['2026-08-13']).toBe(DateType.fertile);
      // Predicted period is not overwritten
      expect(types['2026-09-01']).toBe(DateType.predictedPeriod);
    });
  });

  describe('expired prediction windows', () => {
    it('does not mark expired prediction windows', () => {
      const stats: PeriodStats = {
        averageCycleLength: 28,
        averagePeriodLength: 5,
        totalRecords: 0,
        recentCycleLengths: [28, 28],
        lastPeriodStart: null,
        nextPeriodDate: '2026-08-10', // window [08-10, 08-14] fully past
        ovulationDate: '2026-07-27',
        fertileWindowStart: '2026-07-22',
        fertileWindowEnd: '2026-07-28',
        canPredict: true,
        typicalCycleDays: null,
        typicalPeriodDays: null,
      };
      const types = computeDateTypes([], stats, '2026-08-19');
      // Expired prediction window not marked
      expect(types['2026-08-10']).toBeUndefined();
      expect(types['2026-08-14']).toBeUndefined();
      // Subsequent iteration still marked: 08-10 + 28 = 09-07
      expect(types['2026-09-07']).toBe(DateType.predictedPeriod);
      // Second-round fertile window: [08-19, 08-25]
      expect(types['2026-08-19']).toBe(DateType.fertile);
      // After fertile window, before next prediction: safe
      expect(types['2026-08-26']).toBe(DateType.safe);
    });
  });

  describe('ovulation and fertile window for past cycles', () => {
    it('renders ovulation and fertile window for past cycles', () => {
      const cycles = [
        makeCycle('2026-08-01', { endDate: '2026-08-05' }),
        makeCycle('2026-08-29', { endDate: '2026-09-02' }),
      ];
      const stats = computeStats(cycles);
      const types = computeDateTypes(cycles, stats, '2026-08-19');
      // Cycle 1 ovulation = next cycle start - 14 = 08-29 - 14 = 08-15
      expect(types['2026-08-15']).toBe(DateType.ovulation);
      // Fertile window (retrospective)
      expect(types['2026-08-12']).toBe(DateType.fertile);
      // Period day
      expect(types['2026-08-03']).toBe(DateType.period);
      // Gap between cycles → safe (retrospective)
      expect(types['2026-08-06']).toBe(DateType.safe);
      // Predicted period from last cycle
      expect(types['2026-09-26']).toBe(DateType.predictedPeriod);
    });
  });

  describe('active cycle handling', () => {
    it('renders prediction while currently in period', () => {
      const cycles = [
        makeCycle('2026-07-21', { endDate: '2026-07-25' }),
        makeCycle('2026-08-18'), // active
      ];
      const stats = computeStats(cycles);
      expect(stats.canPredict).toBe(true);
      const types = computeDateTypes(cycles, stats, '2026-08-19');
      // Active period marked through today
      expect(types['2026-08-19']).toBe(DateType.period);
      // Predicted next period: 08-18 + 28 = 09-15
      expect(types['2026-09-15']).toBe(DateType.predictedPeriod);
      // Active cycle ovulation prediction: 08-18 + 28 - 14 = 09-01
      expect(types['2026-09-01']).toBe(DateType.ovulation);
      // Previous cycle ovulation retrospective: 08-18 - 14 = 08-04
      expect(types['2026-08-04']).toBe(DateType.ovulation);
      // Previous cycle fertile window retrospective
      expect(types['2026-08-02']).toBe(DateType.fertile);
    });

    it('active period days after today are not marked safe', () => {
      const cycles = [
        makeCycle('2026-07-22', { endDate: '2026-07-26' }),
        makeCycle('2026-08-19'), // active, starts today
      ];
      const stats = computeStats(cycles);
      expect(stats.canPredict).toBe(true);
      const types = computeDateTypes(cycles, stats, '2026-08-19');
      // Today is period
      expect(types['2026-08-19']).toBe(DateType.period);
      // Tomorrow onwards: predicted period continuation (avgPeriod=5, so 08-19 + 4 = 08-23)
      expect(types['2026-08-20']).toBe(DateType.predictedPeriod);
      expect(types['2026-08-22']).toBe(DateType.predictedPeriod);
      expect(types['2026-08-23']).not.toBe(DateType.safe);
      // After expected end: safe
      expect(types['2026-08-24']).toBe(DateType.safe);
      // Next predicted period
      expect(types['2026-09-16']).toBe(DateType.predictedPeriod);
    });
  });
});
