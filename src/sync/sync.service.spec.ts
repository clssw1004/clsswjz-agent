import { SyncService } from './sync.service';
import { SyncState } from '../enums/sync-state.enum';

/* ---------- mock helpers ---------- */

function mockLogRepo(logs: any[] = []) {
  const store = [...logs];
  return {
    find: jest.fn(async (opts?: any) => {
      let result = [...store];
      if (opts?.where) {
        result = result.filter((l) => {
          if (opts.where.syncState && l.syncState !== opts.where.syncState) return false;
          return true;
        });
      }
      return result;
    }),
    countBy: jest.fn(async (q: any) => {
      return store.filter((l) => l.syncState === q.syncState).length;
    }),
    save: jest.fn(async (d: any) => { store.push(d); return d; }),
    update: jest.fn(),
    create: jest.fn((d: any) => d),
    _store: store,
  };
}

/* ---------- tests ---------- */

describe('SyncService', () => {
  describe('push', () => {
    it('should return pushed:0 when no unsynced logs', async () => {
      const logRepo = mockLogRepo([]);
      const connMgr = { getRepository: jest.fn(async () => logRepo) } as any;
      const userService = { findById: jest.fn(async () => ({ id: 'u1', mainServerUrl: 'http://server', mainToken: 'tok' })) } as any;
      const materialize = { flush: jest.fn() } as any;

      const svc = new SyncService(connMgr, userService, materialize, {} as any);
      const result = await svc.push('u1');

      expect(result.pushed).toBe(0);
    });
  });

  describe('isSyncing', () => {
    it('should return false when not syncing', () => {
      const svc = new SyncService({} as any, {} as any, {} as any, {} as any);
      expect(svc.isSyncing('u1')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should count UNSYNCED and FAILED logs', async () => {
      const logRepo = mockLogRepo([
        { id: 'l1', syncState: SyncState.UNSYNCED },
        { id: 'l2', syncState: SyncState.UNSYNCED },
        { id: 'l3', syncState: SyncState.FAILED },
        { id: 'l4', syncState: SyncState.SYNCED },
      ]);
      const connMgr = { getRepository: jest.fn(async () => logRepo) } as any;

      const svc = new SyncService(connMgr, {} as any, {} as any, {} as any);

      // Override countBy to return precise values based on the store
      logRepo.countBy = jest.fn(async (q: any) => {
        return logRepo._store.filter((l: any) => l.syncState === q.syncState).length;
      });

      const status = await svc.getStatus('u1');

      expect(status.unsynced).toBe(2);
      expect(status.failed).toBe(1);
    });
  });

  describe('auth expiry tracking', () => {
    it('should set, check, and clear auth expiry', () => {
      const svc = new SyncService({} as any, {} as any, {} as any, {} as any);

      expect(svc.isMainAuthExpired('u1')).toBe(false);

      // Access private map via bracket notation
      svc['mainAuthExpired'].set('u1', true);
      expect(svc.isMainAuthExpired('u1')).toBe(true);

      svc.clearAuthExpired('u1');
      expect(svc.isMainAuthExpired('u1')).toBe(false);
    });
  });
});
