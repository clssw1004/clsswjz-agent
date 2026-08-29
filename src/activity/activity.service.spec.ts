import { ActivityService } from './activity.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';

/* ---------- mock helpers ---------- */

function mockRepo<T extends Record<string, any>>(seed: T[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async (q?: any) => {
      let rows = [...store];
      if (q?.where) {
        rows = rows.filter((r) =>
          Object.entries(q.where).every(([k, v]) => r[k] === v),
        );
      }
      if (q?.order && typeof q.order === 'object') {
        const [k, dir] = Object.entries(q.order)[0] as [string, string];
        rows.sort((a: any, b: any) => {
          const cmp = String(a[k]).localeCompare(String(b[k]));
          return dir === 'DESC' ? -cmp : cmp;
        });
      }
      return rows;
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
      } else if (typeof q === 'object' && q !== null) {
        for (let i = store.length - 1; i >= 0; i--) {
          if (Object.entries(q).every(([k, v]) => (store[i] as any)[k] === v)) store.splice(i, 1);
        }
      }
    }),
  };
}

function buildService() {
  const defRepo = mockRepo();
  const recordRepo = mockRepo();
  const logRepo = mockRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'ActivityDefinition') return defRepo;
      if (name === 'ActivityRecord') return recordRepo;
      return null;
    }),
  } as any;
  const service = new ActivityService(connMgr);
  return { service, defRepo, recordRepo, logRepo, connMgr };
}

/* ---------- tests ---------- */

describe('ActivityService', () => {
  describe('ActivityDefinition CRUD', () => {
    it('findAllDefinitions filters by accountBookId and orders by sortOrder', async () => {
      const { service, defRepo } = buildService();
      defRepo.store.push(
        { id: 'd1', accountBookId: 'b1', name: '跑步', sortOrder: 2 },
        { id: 'd2', accountBookId: 'b1', name: '阅读', sortOrder: 1 },
        { id: 'd3', accountBookId: 'b2', name: '冥想', sortOrder: 0 },
      );

      const result = await service.findAllDefinitions('u1', { accountBookId: 'b1' });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('d2'); // sortOrder=1 first
      expect(result[1].id).toBe('d1'); // sortOrder=2 second
    });

    it('createDefinition persists record and writes CREATE LogSync', async () => {
      const { service, defRepo, logRepo } = buildService();

      const result = await service.createDefinition('u1', {
        accountBookId: 'b1',
        name: '跑步',
        emoji: '🏃',
        color: 4289520051,
        sortOrder: 0,
        maxDailyCount: 1,
      });

      expect(defRepo.save).toHaveBeenCalled();
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.ACTIVITY_DEFINITION);
      expect(log.operateType).toBe(OperateType.CREATE);
      expect(log.parentType).toBe('book');
      expect(log.parentId).toBe('b1');
      expect(log.operatorId).toBe('u1');
      expect(log.syncState).toBe('unsynced');
      expect(log.syncTime).toBe(-1);
      expect(result.name).toBe('跑步');
    });

    it('updateDefinition applies patch and writes UPDATE LogSync', async () => {
      const { service, defRepo, logRepo } = buildService();
      defRepo.store.push({
        id: 'd1', accountBookId: 'b1', name: '跑步', sortOrder: 0,
      });

      const updated = await service.updateDefinition('u1', 'd1', {
        name: '晨跑',
        sortOrder: 5,
      });

      expect(defRepo.update).toHaveBeenCalledWith('d1', expect.objectContaining({
        name: '晨跑', sortOrder: 5, updatedBy: 'u1',
      }));
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.ACTIVITY_DEFINITION);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(log.businessId).toBe('d1');
      expect(log.parentId).toBe('b1');
      expect(updated.name).toBe('晨跑');
    });

    it('removeDefinition deletes record and writes DELETE LogSync', async () => {
      const { service, defRepo, logRepo } = buildService();
      defRepo.store.push({ id: 'd1', accountBookId: 'b1', name: '跑步' });

      const result = await service.removeDefinition('u1', 'd1');

      expect(result).toEqual({ deleted: true });
      expect(defRepo.delete).toHaveBeenCalledWith('d1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.ACTIVITY_DEFINITION);
      expect(log.operateType).toBe(OperateType.DELETE);
      expect(log.businessId).toBe('d1');
      expect(log.parentId).toBe('b1');
    });
  });

  describe('ActivityRecord CRUD', () => {
    it('findAllRecords filters by accountBookId', async () => {
      const { service, recordRepo } = buildService();
      recordRepo.store.push(
        { id: 'r1', accountBookId: 'b1', activityName: '跑步', recordDate: '2026-08-20' },
        { id: 'r2', accountBookId: 'b2', activityName: '阅读', recordDate: '2026-08-21' },
      );

      const result = await service.findAllRecords('u1', { accountBookId: 'b1' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('findAllRecords filters by activityDefId', async () => {
      const { service, recordRepo } = buildService();
      recordRepo.store.push(
        { id: 'r1', accountBookId: 'b1', activityDefId: 'd1', recordDate: '2026-08-20' },
        { id: 'r2', accountBookId: 'b1', activityDefId: 'd2', recordDate: '2026-08-20' },
        { id: 'r3', accountBookId: 'b1', activityDefId: 'd1', recordDate: '2026-08-21' },
      );

      const result = await service.findAllRecords('u1', {
        accountBookId: 'b1',
        activityDefId: 'd1',
      });
      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.activityDefId === 'd1')).toBe(true);
    });

    it('findAllRecords filters by date', async () => {
      const { service, recordRepo } = buildService();
      recordRepo.store.push(
        { id: 'r1', accountBookId: 'b1', activityName: '跑步', recordDate: '2026-08-20' },
        { id: 'r2', accountBookId: 'b1', activityName: '阅读', recordDate: '2026-08-21' },
      );

      const result = await service.findAllRecords('u1', {
        accountBookId: 'b1',
        date: '2026-08-20',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('r1');
    });

    it('createRecord persists check-in and writes CREATE LogSync', async () => {
      const { service, recordRepo, logRepo } = buildService();

      const result = await service.createRecord('u1', {
        accountBookId: 'b1',
        activityName: '跑步',
        location: '操场',
        recordDate: '2026-08-20',
        activityDefId: 'd1',
        remark: '跑了 5 公里',
      });

      expect(recordRepo.save).toHaveBeenCalled();
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.ACTIVITY);
      expect(log.operateType).toBe(OperateType.CREATE);
      expect(log.parentType).toBe('book');
      expect(log.parentId).toBe('b1');
      expect(log.operatorId).toBe('u1');
      expect(log.syncState).toBe('unsynced');
      expect(result.activityName).toBe('跑步');
      expect(result.location).toBe('操场');
    });

    it('removeRecord deletes check-in and writes DELETE LogSync', async () => {
      const { service, recordRepo, logRepo } = buildService();
      recordRepo.store.push({
        id: 'r1', accountBookId: 'b1', activityName: '跑步', recordDate: '2026-08-20',
      });

      const result = await service.removeRecord('u1', 'r1');

      expect(result).toEqual({ deleted: true });
      expect(recordRepo.delete).toHaveBeenCalledWith('r1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.ACTIVITY);
      expect(log.operateType).toBe(OperateType.DELETE);
      expect(log.businessId).toBe('r1');
      expect(log.parentId).toBe('b1');
    });

    it('findOneDefinition returns the definition by id', async () => {
      const { service, defRepo } = buildService();
      defRepo.store.push(
        { id: 'd1', accountBookId: 'b1', name: '跑步' },
        { id: 'd2', accountBookId: 'b1', name: '阅读' },
      );

      const result = await service.findOneDefinition('u1', 'd2');
      expect(defRepo.findOneBy).toHaveBeenCalledWith({ id: 'd2' });
      expect(result).toEqual({ id: 'd2', accountBookId: 'b1', name: '阅读' });
    });
  });
});
