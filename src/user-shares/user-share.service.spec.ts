import { UserShareService } from './user-share.service';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';

/* ---------- mock helpers ---------- */

function mockRepo<T extends Record<string, any>>(seed: T[] = []) {
  const store = [...seed];
  return {
    store,
    find: jest.fn(async (q?: any) => {
      if (q?.where) {
        return store.filter((r) => Object.entries(q.where).every(([k, v]) => r[k] === v));
      }
      return [...store];
    }),
    findOne: jest.fn(async (q: any) => {
      if (q && q.where) {
        return store.find((r) => Object.entries(q.where).every(([k, v]) => r[k] === v)) || null;
      }
      return null;
    }),
    findOneBy: jest.fn(async (q: any) =>
      store.find((r) => Object.entries(q).every(([k, v]) => r[k] === v)) || null,
    ),
    findByIds: jest.fn(async (ids: string[]) => store.filter((r) => ids.includes(r.id))),
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
    createQueryBuilder: jest.fn(() => {
      let bookIds: string[] | null = null;
      let excludeUserId = '';
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn((_c: string, p?: any) => { if (p?.bookIds) bookIds = p.bookIds; return qb; }),
        andWhere: jest.fn((_c: string, p?: any) => {
          if (p?.userId) excludeUserId = p.userId;
          return qb;
        }),
        getRawMany: async () => {
          // 模拟 rel_accountbook_user 表：memberRepo.store 即成员关系行
          return store
            .filter((r: any) =>
              (!bookIds || bookIds.includes((r as any).accountBookId)) &&
              (r as any).userId !== excludeUserId)
            .map((r: any) => ({ userId: r.userId }));
        },
      };
      return qb;
    }),
  };
}

function buildService() {
  const shareRepo = mockRepo();
  const memberRepo = mockRepo();
  const userRepo = mockRepo();
  const logRepo = mockRepo();
  const connMgr = {
    getRepository: jest.fn(async (_userId: string, entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      if (name === 'LogSync') return logRepo;
      if (name === 'UserShare') return shareRepo;
      if (name === 'AppUser') return userRepo;
      if (name === 'AccountBookUser') return memberRepo;
      throw new Error('unexpected entity: ' + name);
    }),
  } as any;
  const service = new UserShareService(connMgr);
  return { service, shareRepo, memberRepo, userRepo, logRepo };
}

/* ---------- tests ---------- */

describe('UserShareService', () => {
  describe('findAll', () => {
    it('returns my shares and shares targeting me (enabled only for sharedToMe)', async () => {
      const { service, shareRepo } = buildService();
      shareRepo.store.push(
        { id: 's1', ownerUserId: 'u1', targetUserId: 'u2', businessType: 'vehicle', isEnabled: true },
        { id: 's2', ownerUserId: 'u3', targetUserId: 'u1', businessType: 'periodCycle', isEnabled: true },
        { id: 's3', ownerUserId: 'u4', targetUserId: 'u1', businessType: 'debt', isEnabled: false },
      );

      const result = await service.findAll('u1');
      expect(result.myShares.map((s) => s.id)).toEqual(['s1']);
      expect(result.sharedToMe.map((s) => s.id)).toEqual(['s2']); // s3 disabled
    });
  });

  describe('listEligibleUsers', () => {
    it('returns book members excluding self', async () => {
      const { service, memberRepo, userRepo } = buildService();
      memberRepo.store.push(
        { id: 'm1', userId: 'u1', accountBookId: 'b1' },
        { id: 'm2', userId: 'u2', accountBookId: 'b1' },
        { id: 'm3', userId: 'u3', accountBookId: 'b1' },
        { id: 'm4', userId: 'u9', accountBookId: 'b-other' }, // 不在共同账本 → 排除
      );
      userRepo.store.push(
        { id: 'u2', nickname: '张三', username: 'zhangsan' },
        { id: 'u3', nickname: '', username: 'lisi' },
      );

      const result = await service.listEligibleUsers('u1');

      expect(result.map((u: any) => u.id).sort()).toEqual(['u2', 'u3']);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).not.toHaveProperty('phone');
      const lisi = result.find((u: any) => u.id === 'u3');
      expect(lisi.nickname).toBe('lisi'); // 空昵称回退 username
    });

    it('returns empty when I belong to no book', async () => {
      const { service } = buildService();
      expect(await service.listEligibleUsers('u1')).toEqual([]);
    });
  });

  describe('setShare', () => {
    it('creates a new share row and writes LogSync', async () => {
      const { service, shareRepo, logRepo } = buildService();

      await service.setShare('u1', { targetUserId: 'u2', businessType: 'vehicle', isEnabled: true });

      expect(shareRepo.save).toHaveBeenCalled();
      expect(shareRepo.store[0]).toMatchObject({
        ownerUserId: 'u1', targetUserId: 'u2', businessType: 'vehicle', isEnabled: true,
      });
      expect(logRepo.save).toHaveBeenCalledTimes(1);
      const log = logRepo.store[0];
      expect(log.businessType).toBe(BusinessType.USER_SHARE);
      expect(log.operateType).toBe(OperateType.UPDATE);
      expect(log.syncState).toBe('unsynced');
    });

    it('toggles periodCycle and auto-links periodDailyRecord', async () => {
      const { service, shareRepo, logRepo } = buildService();

      await service.setShare('u1', { targetUserId: 'u2', businessType: 'periodCycle', isEnabled: true });

      const types = shareRepo.store.map((r) => r.businessType).sort();
      expect(types).toEqual(['periodCycle', 'periodDailyRecord']);
      expect(logRepo.save).toHaveBeenCalledTimes(2); // 两行各一条日志
    });

    it('updates isEnabled on existing row without duplicating', async () => {
      const { service, shareRepo } = buildService();
      shareRepo.store.push({
        id: 's1', ownerUserId: 'u1', targetUserId: 'u2',
        businessType: 'vehicle', isEnabled: true,
      });

      await service.setShare('u1', { targetUserId: 'u2', businessType: 'vehicle', isEnabled: false });

      expect(shareRepo.store).toHaveLength(1);
      expect(shareRepo.store[0].isEnabled).toBe(false);
    });
  });

  describe('removeAllForTarget', () => {
    it('removes all rows for the target and writes DELETE logs', async () => {
      const { service, shareRepo, logRepo } = buildService();
      shareRepo.store.push(
        { id: 's1', ownerUserId: 'u1', targetUserId: 'u2', businessType: 'vehicle', isEnabled: true },
        { id: 's2', ownerUserId: 'u1', targetUserId: 'u2', businessType: 'debt', isEnabled: false },
        { id: 's3', ownerUserId: 'u1', targetUserId: 'u3', businessType: 'debt', isEnabled: true }, // 其他目标保留
      );

      const result = await service.removeAllForTarget('u1', 'u2');

      expect(result).toEqual({ deleted: 2 });
      expect(shareRepo.store.map((r) => r.id)).toEqual(['s3']);
      expect(logRepo.save).toHaveBeenCalledTimes(2);
      expect(logRepo.store[0].operateType).toBe(OperateType.DELETE);
    });
  });
});
