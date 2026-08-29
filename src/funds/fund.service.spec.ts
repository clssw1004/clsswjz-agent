import { FundService } from './fund.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/* ---------- mock helpers ---------- */

function mockFundRepo(seed: any[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async (q?: any) => {
      if (q?.where) {
        return store.filter((r) =>
          Object.entries(q.where).every(([k, v]) => r[k] === v),
        );
      }
      return [...store];
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
    update: jest.fn(async (id: string, patch: any) => {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) Object.assign(store[idx], patch);
    }),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'string') {
        const idx = store.findIndex((r) => r.id === q);
        if (idx >= 0) store.splice(idx, 1);
      }
    }),
  };
}

function mockLogRepo() {
  const store: any[] = [];
  return {
    store,
    save: jest.fn(async (d: any) => { store.push(d); return d; }),
    create: jest.fn((d: any) => d),
  };
}

function buildService(fundSeed: any[] = []) {
  const fundRepo = mockFundRepo(fundSeed);
  const logRepo = mockLogRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'AccountFund') return fundRepo;
      throw new Error('unexpected entity: ' + name);
    }),
  } as any;
  return { service: new FundService(connMgr), fundRepo, logRepo };
}

/* ---------- tests ---------- */

describe('FundService', () => {
  describe('findAll', () => {
    it('returns all funds when no accountBookId filter', async () => {
      const { service, fundRepo } = buildService([
        { id: 'f1', name: '现金', accountBookId: 'b1' },
        { id: 'f2', name: '银行卡', accountBookId: 'b2' },
      ]);

      const result = await service.findAll('u1', {});

      expect(result).toHaveLength(2);
      expect(fundRepo.find).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by accountBookId when provided', async () => {
      const { service, fundRepo } = buildService([
        { id: 'f1', name: '现金', accountBookId: 'b1' },
        { id: 'f2', name: '银行卡', accountBookId: 'b2' },
      ]);

      const result = await service.findAll('u1', { accountBookId: 'b1' });

      expect(result).toHaveLength(1);
      expect(fundRepo.find).toHaveBeenCalledWith({ where: { accountBookId: 'b1' } });
    });
  });

  describe('findOne', () => {
    it('returns the fund by id', async () => {
      const { service, fundRepo } = buildService([
        { id: 'f1', name: '现金' },
      ]);

      const result = await service.findOne('u1', 'f1');

      expect(result).toMatchObject({ id: 'f1', name: '现金' });
      expect(fundRepo.findOneBy).toHaveBeenCalledWith({ id: 'f1' });
    });
  });

  describe('create', () => {
    it('saves the fund, sets createdBy/updatedBy, and writes an unsynced CREATE log', async () => {
      const { service, fundRepo, logRepo } = buildService();

      const data = {
        name: '招商银行',
        fundType: 'BANK',
        fundBalance: 1000.5,
        fundRemark: '主用卡',
        isDefault: true,
        accountBookId: 'b1',
      };
      const saved = await service.create('u1', data);

      expect(saved.name).toBe('招商银行');
      expect(fundRepo.save).toHaveBeenCalledTimes(1);
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log).toMatchObject({
        businessType: BusinessType.FUND,
        operateType: OperateType.CREATE,
        parentType: 'book',
        parentId: 'b1',
        operatorId: 'u1',
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      });
      expect(log.businessId).toBe(saved.id);
      expect(typeof log.operateData).toBe('string');
      expect(JSON.parse(log.operateData).name).toBe('招商银行');
      expect(typeof log.operatedAt).toBe('number');
    });
  });

  describe('update', () => {
    it('applies the patch and writes an unsynced UPDATE log with the new state', async () => {
      const { service, fundRepo, logRepo } = buildService([
        { id: 'f1', name: '现金', fundType: 'CASH', fundBalance: 100, accountBookId: 'b1' },
      ]);

      const updated = await service.update('u1', 'f1', { name: '钱包', fundBalance: 200 });

      expect(updated.name).toBe('钱包');
      expect(fundRepo.update).toHaveBeenCalledWith('f1', { name: '钱包', fundBalance: 200, updatedBy: 'u1' });
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.FUND);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(log.businessId).toBe('f1');
      expect(log.parentId).toBe('b1');
      expect(log.syncState).toBe(SyncState.UNSYNCED);
      expect(JSON.parse(log.operateData)).toMatchObject({ id: 'f1', name: '钱包', fundBalance: 200 });
    });
  });

  describe('remove', () => {
    it('deletes the fund and writes an unsynced DELETE log referencing the original accountBookId', async () => {
      const { service, fundRepo, logRepo } = buildService([
        { id: 'f1', name: '现金', accountBookId: 'b1' },
      ]);

      const result = await service.remove('u1', 'f1');

      expect(result).toEqual({ deleted: true });
      expect(fundRepo.delete).toHaveBeenCalledWith('f1');
      expect(logRepo.save).toHaveBeenCalledTimes(1);

      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.FUND);
      expect(log.operateType).toBe(OperateType.DELETE);
      expect(log.businessId).toBe('f1');
      expect(log.parentId).toBe('b1');
      expect(log.syncState).toBe(SyncState.UNSYNCED);
      expect(log.syncTime).toBe(-1);
    });
  });
});
