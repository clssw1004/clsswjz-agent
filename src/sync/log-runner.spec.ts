import { LogRunner } from './log-runner';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';
import { LogSync } from '../entities/log-sync.entity';

/* ---------- helpers ---------- */

function makeLog(overrides: Partial<LogSync>): LogSync {
  return {
    id: 'log1',
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
    syncError: null as any,
    materializedAt: null as any,
    materializeError: null as any,
    generateId: undefined as any,
    ...overrides,
  } as LogSync;
}

function mockRepo(columns: string[] = ['id', 'name', 'accountBookId', 'tagCode']) {
  const store: any[] = [];
  return {
    metadata: { columns: columns.map((propertyName) => ({ propertyName })) },
    store,
    save: jest.fn(async (data: any) => {
      if (Array.isArray(data)) { store.push(...data); return data; }
      store.push(data);
      return data;
    }),
    find: jest.fn(async () => store),
    findOneBy: jest.fn(async (q: any) => store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'string' || typeof q === 'number') {
        const idx = store.findIndex((r) => r.id === q);
        if (idx >= 0) store.splice(idx, 1);
      } else if (Array.isArray(q)) {
        for (const id of q) {
          const idx = store.findIndex((r) => r.id === id);
          if (idx >= 0) store.splice(idx, 1);
        }
      } else if (typeof q === 'object') {
        for (let i = store.length - 1; i >= 0; i--) {
          if (Object.entries(q).every(([k, v]) => store[i][k] === v)) store.splice(i, 1);
        }
      }
    }),
    update: jest.fn(),
    create: jest.fn((d: any) => d),
  };
}

function mockDataSource(repos: Record<string, ReturnType<typeof mockRepo>> = {}) {
  const defaultRepo = mockRepo();
  return {
    getRepository: jest.fn((entityOrName: any) => {
      const name = typeof entityOrName === 'string' ? entityOrName : entityOrName?.name || entityOrName;
      return repos[name] || repos[Object.keys(repos)[0]] || defaultRepo;
    }),
  } as any;
}

/* ---------- tests ---------- */

describe('LogRunner', () => {
  let runner: LogRunner;

  beforeEach(() => {
    runner = new LogRunner();
  });

  describe('runLogSync — CREATE', () => {
    it('should save a new record', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({ businessType: BusinessType.ITEM, operateData: JSON.stringify({ id: 'i1', name: 'coffee' }) });

      await runner.runLogSync(log, ds);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.store[0]).toMatchObject({ id: 'i1', name: 'coffee' });
    });

    it('should strip unknown columns via sanitize', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateData: JSON.stringify({ id: 'c1', name: 'Food', fakeCol: 'ignored' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.store[0]).not.toHaveProperty('fakeCol');
      expect(repo.store[0]).toHaveProperty('name', 'Food');
    });

    it('should inject businessId as id when operateData has no id', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({ businessId: 'fallback-id', operateData: JSON.stringify({ name: 'no-id-item' }) });

      await runner.runLogSync(log, ds);

      expect(repo.store[0].id).toBe('fallback-id');
    });

    it('should upsert USER_SHARE by identity', async () => {
      const repo = mockRepo(['id', 'ownerUserId', 'targetUserId', 'businessType', 'scope']);
      repo.findOneBy = jest.fn(async (_q: any) => ({ id: 'existing', ownerUserId: 'u1', targetUserId: 'u2', businessType: 'ITEM', scope: 'old' }));
      const ds = mockDataSource({ UserShare: repo });
      const log = makeLog({
        businessType: BusinessType.USER_SHARE,
        operateData: JSON.stringify({ id: 'x', ownerUserId: 'u1', targetUserId: 'u2', businessType: 'ITEM', scope: 'new' }),
      });

      await runner.runLogSync(log, ds);

      // Should save with existing id, not the new one
      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.id).toBe('existing');
      expect(saved.scope).toBe('new');
    });

    it('should upsert ITEM_RELATION by identity', async () => {
      const repo = mockRepo(['id', 'itemId', 'relationCode', 'relationId']);
      repo.findOneBy = jest.fn(async (_q: any) => null); // no existing
      const ds = mockDataSource({ ItemRelation: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM_RELATION,
        operateData: JSON.stringify({ id: 'rel1', itemId: 'i1', relationCode: 'linked', relationId: 'i2' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.save).toHaveBeenCalled();
      expect(repo.store[0]).toMatchObject({ itemId: 'i1', relationCode: 'linked', relationId: 'i2' });
    });

    it('should serialize arrays/objects to JSON strings in text columns', async () => {
      const repo = mockRepo(['id', 'symptoms', 'mood']);
      const ds = mockDataSource({ PeriodDailyRecord: repo });
      const log = makeLog({
        businessType: BusinessType.PERIOD_DAILY_RECORD,
        operateData: JSON.stringify({ id: 'p1', symptoms: ['headache', 'cramps'], mood: 'bad' }),
      });

      await runner.runLogSync(log, ds);

      expect(typeof repo.store[0].symptoms).toBe('string');
      expect(repo.store[0].symptoms).toBe(JSON.stringify(['headache', 'cramps']));
      expect(repo.store[0].mood).toBe('bad'); // primitive passes through
    });
  });

  describe('runLogSync — BATCH_CREATE', () => {
    it('should save an array of records', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateType: OperateType.BATCH_CREATE,
        operateData: JSON.stringify([
          { id: 'c1', name: 'Food' },
          { id: 'c2', name: 'Transport' },
        ]),
      });

      await runner.runLogSync(log, ds);

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(repo.store).toHaveLength(2);
    });

    it('should handle single non-array data', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateType: OperateType.BATCH_CREATE,
        operateData: JSON.stringify({ id: 'c1', name: 'Solo' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('runLogSync — UPDATE', () => {
    it('should call repo.update with sanitized fields (no id)', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.UPDATE,
        businessId: 'i1',
        operateData: JSON.stringify({ id: 'i1', name: 'updated' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).toHaveBeenCalledWith('i1', expect.objectContaining({ name: 'updated' }));
      // id should be stripped from update fields
      const updateFields = repo.update.mock.calls[0][1];
      expect(updateFields).not.toHaveProperty('id');
    });

    it('should skip update when no businessId', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.UPDATE,
        businessId: undefined as any,
        operateData: JSON.stringify({ name: 'ghost' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should skip update when all fields are stripped (empty sanitize result)', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.UPDATE,
        businessId: 'i1',
        operateData: JSON.stringify({ id: 'i1', unknownField: 'x' }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('runLogSync — DELETE', () => {
    it('should delete by businessId', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.DELETE,
        businessId: 'i1',
      });

      await runner.runLogSync(log, ds);

      expect(repo.delete).toHaveBeenCalledWith('i1');
    });

    it('should cascade delete for BOOK type', async () => {
      const childRepos: Record<string, ReturnType<typeof mockRepo>> = {};
      for (const name of ['AttachmentEntity', 'AccountCategory', 'AccountShop', 'AccountNote', 'AccountSymbol', 'AccountBookUser', 'AccountItem']) {
        childRepos[name] = mockRepo(['id', 'accountBookId']);
      }
      const bookRepo = mockRepo(['id']);
      childRepos['AccountBook'] = bookRepo;

      const ds = {
        getRepository: jest.fn((entity: any) => {
          const n = typeof entity === 'string' ? entity : entity?.name;
          return childRepos[n] || bookRepo;
        }),
      } as any;

      const log = makeLog({
        businessType: BusinessType.BOOK,
        operateType: OperateType.DELETE,
        businessId: 'book1',
      });

      await runner.runLogSync(log, ds);

      // Book repo delete should be called
      expect(bookRepo.delete).toHaveBeenCalled();
    });
  });

  describe('runLogSync — BATCH_DELETE', () => {
    it('should delete multiple ids', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.BATCH_DELETE,
        operateData: JSON.stringify({ ids: ['i1', 'i2', 'i3'] }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.delete).toHaveBeenCalledWith(['i1', 'i2', 'i3']);
    });

    it('should fall back to businessId when no ids array', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.BATCH_DELETE,
        businessId: 'only-one',
      });

      await runner.runLogSync(log, ds);

      expect(repo.delete).toHaveBeenCalledWith('only-one');
    });
  });

  describe('runLogSync — BATCH_UPDATE', () => {
    it('should update array of objects', async () => {
      const repo = mockRepo(['id', 'name', 'sortOrder']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateType: OperateType.BATCH_UPDATE,
        operateData: JSON.stringify([
          { id: 'c1', name: 'A' },
          { id: 'c2', name: 'B' },
        ]),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).toHaveBeenCalledTimes(2);
      expect(repo.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'A' }));
      expect(repo.update).toHaveBeenCalledWith('c2', expect.objectContaining({ name: 'B' }));
    });

    it('should handle ids + data parallel arrays format', async () => {
      const repo = mockRepo(['id', 'name', 'sortOrder']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateType: OperateType.BATCH_UPDATE,
        operateData: JSON.stringify({
          ids: ['c1', 'c2'],
          data: [{ name: 'X' }, { name: 'Y' }],
        }),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).toHaveBeenCalledTimes(2);
      expect(repo.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'X' }));
      expect(repo.update).toHaveBeenCalledWith('c2', expect.objectContaining({ name: 'Y' }));
    });

    it('should handle string-encoded JSON items in array', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountCategory: repo });
      const log = makeLog({
        businessType: BusinessType.CATEGORY,
        operateType: OperateType.BATCH_UPDATE,
        operateData: JSON.stringify([
          JSON.stringify({ id: 'c1', name: 'FromJSON' }),
        ]),
      });

      await runner.runLogSync(log, ds);

      expect(repo.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'FromJSON' }));
    });
  });

  describe('runLogSync — tag sync for ITEM', () => {
    it('should not throw on null operateData', async () => {
      const repo = mockRepo(['id', 'name']);
      const ds = mockDataSource({ AccountItem: repo });
      const log = makeLog({
        businessType: BusinessType.ITEM,
        operateType: OperateType.CREATE,
        operateData: null as any,
      });

      // Should not throw
      await expect(runner.runLogSync(log, ds)).resolves.toBeUndefined();
    });

    it('should skip unknown business types', async () => {
      const ds = mockDataSource();
      const log = makeLog({ businessType: 'UNKNOWN_TYPE' as any });

      await runner.runLogSync(log, ds);

      // getRepository should not even be called
      expect(ds.getRepository).not.toHaveBeenCalled();
    });
  });
});
