import { PeriodService } from './period.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';

/* ---------- mock helpers ---------- */

function mockRepo<T extends Record<string, any>>(seed: T[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async () => [...store]),
    findOne: jest.fn(async (q: any) => {
      if (q && q.where) {
        return store.find((r) => Object.entries(q.where).every(([k, v]) => r[k] === v)) || null;
      }
      return null;
    }),
    findOneBy: jest.fn(async (q: any) =>
      store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null,
    ),
    save: jest.fn(async (d: any) => {
      if (!d.id) d.id = 'gen-' + Math.random().toString(36).slice(2, 8);
      store.push(d);
      return d;
    }),
    create: jest.fn((d: any) => d),
    update: jest.fn(async (_id: string, patch: any) => {
      const idx = store.findIndex((r) => r.id === _id);
      if (idx >= 0) Object.assign(store[idx], patch);
    }),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'string') {
        const idx = store.findIndex((r) => r.id === q);
        if (idx >= 0) store.splice(idx, 1);
      } else if (typeof q === 'object') {
        for (let i = store.length - 1; i >= 0; i--) {
          if (Object.entries(q).every(([k, v]) => (store[i] as any)[k] === v)) store.splice(i, 1);
        }
      }
    }),
  };
}

function buildService() {
  const cycleRepo = mockRepo();
  const dailyRepo = mockRepo();
  const logRepo = mockRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'PeriodDailyRecord') return dailyRepo;
      return cycleRepo;
    }),
  } as any;
  const service = new PeriodService(connMgr);
  return { service, cycleRepo, dailyRepo, logRepo, connMgr };
}

/* ---------- tests ---------- */

describe('PeriodService', () => {
  describe('listCycles', () => {
    it('returns all cycles by default', async () => {
      const { service, cycleRepo } = buildService();
      cycleRepo.store.push(
        { id: 'c1', startDate: '2026-08-01', endDate: '2026-08-05', createdBy: 'u1' },
        { id: 'c2', startDate: '2026-07-01', endDate: '2026-07-05', createdBy: 'u1' },
      );

      const result = await service.listCycles('u1', {});
      expect(result).toHaveLength(2);
    });

    it('returns only active cycle when active=true', async () => {
      const { service, cycleRepo } = buildService();
      cycleRepo.store.push(
        { id: 'c1', startDate: '2026-08-10', endDate: null, createdBy: 'u1' },
        { id: 'c2', startDate: '2026-08-01', endDate: '2026-08-05', createdBy: 'u1' },
      );

      const result = await service.listCycles('u1', { active: true });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('filters by recent days', async () => {
      const { service, cycleRepo } = buildService();
      // recent=7 → cutoff ~2026-08-17
      cycleRepo.store.push(
        { id: 'c1', startDate: '2026-08-20', endDate: '2026-08-23', createdBy: 'u1' },
        { id: 'c2', startDate: '2026-07-01', endDate: '2026-07-05', createdBy: 'u1' },
      );

      const result = await service.listCycles('u1', { recent: 7 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('filters by year+month', async () => {
      const { service, cycleRepo } = buildService();
      cycleRepo.store.push(
        { id: 'c1', startDate: '2026-08-10', endDate: '2026-08-15', createdBy: 'u1' },
        { id: 'c2', startDate: '2026-07-01', endDate: '2026-07-05', createdBy: 'u1' },
        { id: 'c3', startDate: '2026-08-25', endDate: null, createdBy: 'u1' },
      );

      const result = await service.listCycles('u1', { year: 2026, month: 8 });
      // c1: 08-10 <= 08-31 && endDate(08-15) >= 08-01 → yes
      // c2: 07-01 > 08-31 → no
      // c3: 08-25 <= 08-31 && no endDate → yes
      expect(result).toHaveLength(2);
    });
  });

  describe('createCycle', () => {
    it('creates cycle and writes LogSync', async () => {
      const { service, cycleRepo, logRepo } = buildService();

      const result = await service.createCycle('u1', { startDate: '2026-08-01', endDate: '2026-08-05' });

      expect(cycleRepo.save).toHaveBeenCalled();
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.PERIOD_CYCLE);
      expect(log.operateType).toBe(OperateType.CREATE);
      expect(log.operatorId).toBe('u1');
      expect(log.syncState).toBe('unsynced');
      expect(result.startDate).toBe('2026-08-01');
    });

    it('creates cycle with typical params', async () => {
      const { service, cycleRepo, logRepo } = buildService();

      const result = await service.createCycle('u1', {
        startDate: '2026-08-01',
        typicalPeriodDays: 5,
        typicalCycleDays: 28,
      });

      expect(cycleRepo.save).toHaveBeenCalled();
      expect(logRepo.store[0].businessType).toBe(BusinessType.PERIOD_CYCLE);
      expect(result.startDate).toBe('2026-08-01');
    });
  });

  describe('updateCycleEnd', () => {
    it('updates endDate and writes LogSync', async () => {
      const { service, cycleRepo, logRepo } = buildService();
      cycleRepo.store.push({ id: 'c1', startDate: '2026-08-10', endDate: null, createdBy: 'u1' });

      const result = await service.updateCycleEnd('u1', 'c1', '2026-08-15');

      expect(cycleRepo.update).toHaveBeenCalledWith('c1', expect.objectContaining({ endDate: '2026-08-15' }));
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.PERIOD_CYCLE);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(result).toBeTruthy();
    });
  });

  describe('deleteCycle', () => {
    it('deletes cycle, daily records, and writes LogSync', async () => {
      const { service, cycleRepo, dailyRepo, logRepo } = buildService();
      cycleRepo.store.push({ id: 'c1', startDate: '2026-08-01' });
      dailyRepo.store.push(
        { id: 'd1', cycleId: 'c1', recordDate: '2026-08-01' },
        { id: 'd2', cycleId: 'c1', recordDate: '2026-08-02' },
      );

      const result = await service.deleteCycle('u1', 'c1');

      expect(result).toEqual({ deleted: true });
      expect(dailyRepo.delete).toHaveBeenCalledWith({ cycleId: 'c1' });
      expect(cycleRepo.delete).toHaveBeenCalledWith('c1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.PERIOD_CYCLE);
      expect(log.operateType).toBe(OperateType.DELETE);
    });
  });

  describe('upsertDailyRecord', () => {
    it('creates new record when none exists', async () => {
      const { service, dailyRepo, logRepo } = buildService();

      const result = await service.upsertDailyRecord('u1', 'c1', {
        recordDate: '2026-08-01',
        flowLevel: 'medium',
        mood: 'happy',
      });

      expect(dailyRepo.save).toHaveBeenCalled();
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.PERIOD_DAILY_RECORD);
      expect(log.operateType).toBe(OperateType.CREATE);
      expect(result.recordDate).toBe('2026-08-01');
    });

    it('updates existing record', async () => {
      const { service, dailyRepo, logRepo } = buildService();
      dailyRepo.store.push({
        id: 'd1',
        cycleId: 'c1',
        recordDate: '2026-08-01',
        flowLevel: 'light',
        symptoms: '[]',
        mood: 'normal',
        remark: null,
      });

      const result = await service.upsertDailyRecord('u1', 'c1', {
        recordDate: '2026-08-01',
        flowLevel: 'heavy',
      });

      expect(dailyRepo.update).toHaveBeenCalledWith('d1', expect.objectContaining({ flowLevel: 'heavy' }));
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(result).toBeTruthy();
    });
  });

  describe('listDailyRecords', () => {
    it('returns records ordered by date ascending', async () => {
      const { service, dailyRepo } = buildService();
      dailyRepo.store.push(
        { id: 'd2', cycleId: 'c1', recordDate: '2026-08-02' },
        { id: 'd1', cycleId: 'c1', recordDate: '2026-08-01' },
      );

      const result = await service.listDailyRecords('u1', 'c1');
      expect(result).toHaveLength(2);
      expect(dailyRepo.find).toHaveBeenCalledWith({
        where: { cycleId: 'c1' },
        order: { recordDate: 'ASC' },
      });
    });
  });
});
