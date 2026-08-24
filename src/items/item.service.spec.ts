import { ItemService } from './item.service';

/* ---------- mock helpers ---------- */

function mockRelRepo(rels: any[] = []) {
  const store = [...rels];
  return {
    find: jest.fn(async () => [...store]),
    findOneBy: jest.fn(async (q: any) => store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null),
    save: jest.fn(async (d: any) => { store.push(d); return d; }),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'object') {
        for (let i = store.length - 1; i >= 0; i--) {
          if (Object.entries(q).every(([k, v]) => store[i][k] === v)) store.splice(i, 1);
        }
      }
    }),
    create: jest.fn((d: any) => d),
    _store: store,
  };
}

function mockItemRepo(items: any[] = []) {
  const store = [...items];
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getCount: jest.fn(async () => store.length),
    getMany: jest.fn(async () => [...store]),
    getRawOne: jest.fn(async () => ({ total: store.reduce((s, i) => s + (i.amount || 0), 0) })),
    getRawMany: jest.fn(async () => []),
  };
  return {
    metadata: { columns: ['id', 'name', 'amount', 'type', 'accountBookId', 'accountDate', 'categoryCode', 'tagCode', 'source', 'sourceId'].map((n) => ({ propertyName: n })) },
    store,
    find: jest.fn(async () => [...store]),
    findOneBy: jest.fn(async (q: any) => store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null),
    save: jest.fn(async (d: any) => { if (!d.id) d.id = 'gen-' + Math.random().toString(36).slice(2, 8); store.push(d); return d; }),
    delete: jest.fn(async (q: any) => {
      if (typeof q === 'string') {
        const idx = store.findIndex((r) => r.id === q);
        if (idx >= 0) store.splice(idx, 1);
      } else if (typeof q === 'object') {
        for (let i = store.length - 1; i >= 0; i--) {
          if (Object.entries(q).every(([k, v]) => store[i][k] === v)) store.splice(i, 1);
        }
      }
    }),
    update: jest.fn(),
    create: jest.fn((d: any) => d),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
    _store: store,
  };
}

function mockLogRepo() {
  const store: any[] = [];
  return {
    store,
    find: jest.fn(async () => store),
    findOneBy: jest.fn(async (q: any) => store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null),
    save: jest.fn(async (d: any) => { store.push(d); return d; }),
    create: jest.fn((d: any) => d),
  };
}

function buildService(itemRepo: ReturnType<typeof mockItemRepo>, relRepo: ReturnType<typeof mockRelRepo>, logRepo: ReturnType<typeof mockLogRepo>) {
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'ItemRelField') return relRepo;
      if (name === 'LogSync') return logRepo;
      return itemRepo;
    }),
  } as any;
  return { service: new ItemService(connMgr), connMgr, itemRepo, relRepo, logRepo };
}

/* ---------- tests ---------- */

describe('ItemService', () => {
  describe('summary', () => {
    it('should return zeros when no items exist', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();
      itemRepo._qb.getRawOne = jest.fn(async () => ({ total: 0 }));

      const { service } = buildService(itemRepo, relRepo, logRepo);
      const result = await summaryWithMock(service, itemRepo);

      expect(result).toEqual({ income: 0, expense: 0, refund: 0, balance: 0 });
    });

    it('should compute income, expense, and balance correctly', async () => {
      const itemRepo = mockItemRepo([
        { id: 'i1', amount: 100, type: 'INCOME', accountBookId: 'b1' },
        { id: 'i2', amount: -50, type: 'EXPENSE', accountBookId: 'b1' },
      ]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();

      const { service } = buildService(itemRepo, relRepo, logRepo);

      // Mock the three raw queries with specific values
      let callCount = 0;
      itemRepo._qb.getRawOne = jest.fn(async () => {
        callCount++;
        if (callCount === 1) return { total: 100 };  // income
        if (callCount === 2) return { total: -50 };  // expense
        return { total: 0 };  // refund
      });

      const result = await summaryWithMock(service, itemRepo);

      expect(result.income).toBe(100);
      expect(result.expense).toBe(-50);
      expect(result.refund).toBe(0);
      expect(result.balance).toBe(50); // 100 + (-50) + 0
    });

    it('should track refund separately', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();

      const { service } = buildService(itemRepo, relRepo, logRepo);
      let callCount = 0;
      itemRepo._qb.getRawOne = jest.fn(async () => {
        callCount++;
        if (callCount === 1) return { total: 200 };   // income
        if (callCount === 2) return { total: -100 };   // expense
        return { total: 30 };                           // refund
      });

      const result = await summaryWithMock(service, itemRepo);

      expect(result.refund).toBe(30);
      expect(result.balance).toBe(130); // 200 + (-100) + 30
    });
  });

  describe('statistics', () => {
    it('should return empty byCategory when no data', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();
      itemRepo._qb.getRawMany = jest.fn(async () => []);

      const { service } = buildService(itemRepo, relRepo, logRepo);
      const result = await service.statistics('user1', {});

      expect(result.byCategory).toEqual([]);
    });

    it('should aggregate by category and sort by absolute total', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();

      let callCount = 0;
      itemRepo._qb.getRawMany = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // income rows
          return [
            { categoryCode: 'salary', total: 5000, count: 1 },
            { categoryCode: 'bonus', total: 2000, count: 1 },
          ];
        }
        // expense rows
        return [
          { categoryCode: 'food', total: -800, count: 10 },
          { categoryCode: 'rent', total: -2000, count: 1 },
        ];
      });

      const { service } = buildService(itemRepo, relRepo, logRepo);
      const result = await service.statistics('user1', {});

      expect(result.byCategory).toHaveLength(4);
      // Sorted by abs(total) descending: salary(5000), rent(2000), bonus(2000), food(800)
      expect(result.byCategory[0].categoryCode).toBe('salary');
      expect(result.byCategory[0].total).toBe(5000);
      expect(result.byCategory[0].type).toBe('INCOME');
    });

    it('should preserve empty categoryCode', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();

      let callCount = 0;
      itemRepo._qb.getRawMany = jest.fn(async () => {
        callCount++;
        if (callCount === 1) return [{ categoryCode: null, total: -100, count: 3 }];
        return [];
      });

      const { service } = buildService(itemRepo, relRepo, logRepo);
      const result = await service.statistics('user1', {});

      expect(result.byCategory[0].categoryCode).toBe('');
    });
  });

  describe('create', () => {
    it('should create item and write LogSync', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();
      const { service } = buildService(itemRepo, relRepo, logRepo);

      const result = await service.create('user1', {
        amount: 50,
        type: 'EXPENSE' as any,
        accountBookId: 'b1',
        accountDate: '2025-01-15',
      });

      expect(itemRepo.save).toHaveBeenCalled();
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe('item');
      expect(log.operateType).toBe('create');
      expect(log.syncState).toBe('unsynced');
    });

    it('should create with tags when tagCodes provided', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();
      itemRepo.save = jest.fn(async (d: any) => { d.id = 'item-new'; return d; });

      const { service } = buildService(itemRepo, relRepo, logRepo);

      await service.create('user1', {
        amount: 30,
        tagCodes: ['food', 'lunch'],
        accountBookId: 'b1',
      } as any);

      // Tags should be saved to relRepo
      expect(relRepo.save).toHaveBeenCalledTimes(2);
      expect(relRepo._store[0]).toMatchObject({ itemId: 'item-new', fieldCode: 'TAG', fieldValue: 'food', sortOrder: 0 });
      expect(relRepo._store[1]).toMatchObject({ itemId: 'item-new', fieldCode: 'TAG', fieldValue: 'lunch', sortOrder: 1 });
    });

    it('should fall back to tagCode when tagCodes not provided', async () => {
      const itemRepo = mockItemRepo([]);
      const relRepo = mockRelRepo();
      const logRepo = mockLogRepo();
      itemRepo.save = jest.fn(async (d: any) => { d.id = 'item-tc'; return d; });

      const { service } = buildService(itemRepo, relRepo, logRepo);

      await service.create('user1', {
        amount: 20,
        tagCode: 'solo-tag',
        accountBookId: 'b1',
      } as any);

      // No tagCodes → no relRepo operations
      expect(relRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete item, clear tags, and write LogSync', async () => {
      const itemRepo = mockItemRepo([{ id: 'i1', accountBookId: 'b1' }]);
      const relRepo = mockRelRepo([{ itemId: 'i1', fieldCode: 'TAG', fieldValue: 'x' }]);
      const logRepo = mockLogRepo();
      const { service } = buildService(itemRepo, relRepo, logRepo);

      const result = await service.remove('user1', 'i1');

      expect(result).toEqual({ deleted: true });
      expect(itemRepo.delete).toHaveBeenCalledWith('i1');
      expect(relRepo.delete).toHaveBeenCalledWith({ itemId: 'i1' });
      expect(logRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});

/* ---------- helper to call summary (tests use custom mock) ---------- */

async function summaryWithMock(service: ItemService, itemRepo: ReturnType<typeof mockItemRepo>) {
  // The summary method calls createQueryBuilder 3 times (income, expense, refund)
  // Our mock already handles this via the shared qb
  return service.summary('user1', {});
}
