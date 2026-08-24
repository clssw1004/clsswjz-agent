import { MaterializeService } from './materialize.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/* ---------- mock helpers ---------- */

function mockLogRepo(logs: any[] = []) {
  const store = [...logs];
  return {
    find: jest.fn(async (opts?: any) => {
      let result = [...store].filter((l) => l.syncState === SyncState.SYNCED && l.materializedAt == null);
      result.sort((a, b) => a.operatedAt - b.operatedAt);
      if (opts?.take) result = result.slice(0, opts.take);
      return result;
    }),
    update: jest.fn(async (id: string, patch: any) => {
      const idx = store.findIndex((l) => l.id === id);
      if (idx >= 0) Object.assign(store[idx], patch);
    }),
    _store: store,
  };
}

function makeLog(overrides: any = {}): any {
  return {
    id: 'log-' + Math.random().toString(36).slice(2, 6),
    businessType: BusinessType.ITEM,
    operateType: OperateType.CREATE,
    parentType: 'book',
    parentId: 'book1',
    operatorId: 'user1',
    operatedAt: Date.now(),
    businessId: 'biz1',
    operateData: JSON.stringify({ id: 'biz1', name: 'test' }),
    syncState: SyncState.SYNCED,
    syncTime: 1,
    materializedAt: null,
    materializeError: null,
    ...overrides,
  };
}

/* ---------- tests ---------- */

describe('MaterializeService', () => {
  let logRunner: { runLogSync: jest.Mock };
  let connMgr: any;

  function buildService(logRepo: ReturnType<typeof mockLogRepo>) {
    logRunner = { runLogSync: jest.fn(async () => {}) };
    connMgr = {
      getDataSource: jest.fn(async () => ({
        getRepository: jest.fn(() => logRepo),
      })),
    };
    const service = new MaterializeService(logRunner as any, connMgr);
    return { service, logRunner };
  }

  describe('flush', () => {
    it('should process SYNCED logs and set materializedAt', async () => {
      const log1 = makeLog({ id: 'l1', syncState: SyncState.SYNCED, materializedAt: null });
      const log2 = makeLog({ id: 'l2', syncState: SyncState.SYNCED, materializedAt: null });
      const logRepo = mockLogRepo([log1, log2]);
      const { service } = buildService(logRepo);

      await service.flush('user1');

      expect(logRunner.runLogSync).toHaveBeenCalledTimes(2);
      expect(logRepo.update).toHaveBeenCalledWith('l1', expect.objectContaining({ materializedAt: expect.any(Number) }));
      expect(logRepo.update).toHaveBeenCalledWith('l2', expect.objectContaining({ materializedAt: expect.any(Number) }));
    });

    it('should skip ROOT and FUND_BOOK types', async () => {
      const rootLog = makeLog({ id: 'r1', businessType: BusinessType.ROOT, syncState: SyncState.SYNCED, materializedAt: null });
      const fundLog = makeLog({ id: 'f1', businessType: BusinessType.FUND_BOOK, syncState: SyncState.SYNCED, materializedAt: null });
      const logRepo = mockLogRepo([rootLog, fundLog]);
      const { service } = buildService(logRepo);

      await service.flush('user1');

      expect(logRunner.runLogSync).not.toHaveBeenCalled();
      // But materializedAt should still be set
      expect(logRepo.update).toHaveBeenCalledTimes(2);
    });

    it('should record materializeError on failure and continue', async () => {
      const badLog = makeLog({ id: 'bad', syncState: SyncState.SYNCED, materializedAt: null });
      const goodLog = makeLog({ id: 'good', syncState: SyncState.SYNCED, materializedAt: null });
      const logRepo = mockLogRepo([badLog, goodLog]);

      // Fail on first call (bad log), succeed on subsequent calls
      let failCount = 0;
      const { service, logRunner: lr } = buildService(logRepo);
      (lr.runLogSync as jest.Mock).mockImplementation(async () => {
        failCount++;
        if (failCount <= 1) throw new Error('replay failed');
      });

      await service.flush('user1');

      // bad log gets error recorded
      const badUpdateCalls = logRepo.update.mock.calls.filter((c: any[]) => c[0] === 'bad');
      const badErrorCall = badUpdateCalls.find((c: any[]) => c[1]?.materializeError);
      expect(badErrorCall).toBeDefined();
      expect(badErrorCall![1]).toHaveProperty('materializeError', 'Error: replay failed');

      // good log still processed
      const goodUpdateCall = logRepo.update.mock.calls.find((c: any[]) => c[0] === 'good');
      expect(goodUpdateCall).toBeDefined();
      expect(goodUpdateCall![1]).toHaveProperty('materializedAt', expect.any(Number));
    });

    it('should not process already-materialized logs', async () => {
      const doneLog = makeLog({ id: 'done', syncState: SyncState.SYNCED, materializedAt: 12345 });
      const logRepo = mockLogRepo([doneLog]);
      const { service } = buildService(logRepo);

      await service.flush('user1');

      expect(logRunner.runLogSync).not.toHaveBeenCalled();
    });

    it('should not process non-SYNCED logs', async () => {
      const unsyncedLog = makeLog({ id: 'u1', syncState: SyncState.UNSYNCED, materializedAt: null });
      const logRepo = mockLogRepo([unsyncedLog]);
      const { service } = buildService(logRepo);

      await service.flush('user1');

      expect(logRunner.runLogSync).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent flush calls', async () => {
      const log = makeLog({ id: 'c1', syncState: SyncState.SYNCED, materializedAt: null });
      const logRepo = mockLogRepo([log]);
      const { service } = buildService(logRepo);

      // Call flush twice concurrently
      const p1 = service.flush('user1');
      const p2 = service.flush('user1');

      await Promise.all([p1, p2]);

      // runLogSync should only be called once (second call returns same promise)
      expect(logRunner.runLogSync).toHaveBeenCalledTimes(1);
    });
  });
});
