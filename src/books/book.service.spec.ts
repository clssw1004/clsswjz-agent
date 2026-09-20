import { BookService } from './book.service';

/**
 * 账本列表可见范围（回归：被共享方账本列表为空）
 *
 * 基准：
 * - gui `BookDao.findPermissionedByUserId` → join rel_accountbook_user 且 canViewBook = true
 * - 主端 `SyncService.getMyBookIds` → account_books.created_by ∪ rel_accountbook_user.user_id
 *
 * 原实现只写 `where: { createdBy: userId }`，别人创建并共享给我的账本完全不展示。
 */

/** 取出 FindOperator（In(...)）里的值，兼容 TypeORM 0.3 的 `_value` / `value` 两种暴露方式 */
function operatorValues(op: any): any[] | undefined {
  if (!op || typeof op !== 'object') return undefined;
  const raw = '_value' in op ? (op as any)._value : (op as any).value;
  return Array.isArray(raw) ? raw : undefined;
}

/** 模拟 account_books 的最小查询语义：where 数组视为 OR */
function makeBookRepo(books: any[]) {
  return {
    findAndCount: jest.fn(async (opts: any) => {
      const conds = Array.isArray(opts.where) ? opts.where : [opts.where];
      const items = books.filter((b) =>
        conds.some((c: any) => {
          if (c.createdBy !== undefined) return b.createdBy === c.createdBy;
          const ids = operatorValues(c.id);
          if (ids) return ids.includes(b.id);
          return false;
        }),
      );
      return [items, items.length];
    }),
  };
}

function makeRelRepo(rels: any[]) {
  return {
    find: jest.fn(async (opts: any) => {
      const { userId, canViewBook } = opts.where;
      return rels.filter(
        (r) => r.userId === userId && r.canViewBook === canViewBook,
      );
    }),
  };
}

function makeService(books: any[], rels: any[]) {
  const bookRepo = makeBookRepo(books);
  const relRepo = makeRelRepo(rels);
  const connMgr = {
    getRepository: jest.fn(async (_uid: string, entity: any) =>
      entity.name === 'AccountBookUser' ? relRepo : bookRepo,
    ),
  } as any;
  return { svc: new BookService(connMgr), bookRepo, relRepo };
}

const ME = 'user_me';
const OTHER = 'user_other';

const myBook = { id: 'b_mine', name: '我的账本', createdBy: ME };
const sharedBook = { id: 'b_shared', name: '别人共享给我的账本', createdBy: OTHER };

describe('BookService.findAll 可见账本', () => {
  it('别人创建、共享给我且 canViewBook=true 的账本必须出现在列表里', async () => {
    const { svc } = makeService(
      [myBook, sharedBook],
      [{ userId: ME, accountBookId: 'b_shared', canViewBook: true }],
    );
    const { items, total } = await svc.findAll(ME);
    expect(items.map((b: any) => b.id).sort()).toEqual(['b_mine', 'b_shared']);
    expect(total).toBe(2);
  });

  it('按当前用户 + canViewBook=true 过滤关系表（把权限判定交给关系表）', async () => {
    const { svc, relRepo } = makeService(
      [myBook, sharedBook],
      [{ userId: ME, accountBookId: 'b_shared', canViewBook: true }],
    );
    await svc.findAll(ME);
    expect(relRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: ME, canViewBook: true } }),
    );
  });

  it('canViewBook=false 的账本不展示（权限被收回）', async () => {
    const { svc } = makeService(
      [myBook, sharedBook],
      [{ userId: ME, accountBookId: 'b_shared', canViewBook: false }],
    );
    const { items } = await svc.findAll(ME);
    expect(items.map((b: any) => b.id)).toEqual(['b_mine']);
  });

  it('没有任何共享关系时退化为 createdBy：自己的账本不会消失', async () => {
    const { svc, bookRepo } = makeService([myBook, sharedBook], []);
    const { items } = await svc.findAll(ME);
    expect(items.map((b: any) => b.id)).toEqual(['b_mine']);
    // 无共享账本时不带 In 条件，保持原来的单条件查询
    expect(bookRepo.findAndCount).toHaveBeenCalledWith({ where: { createdBy: ME } });
  });

  it('关系表里有重复行 / 空 bookId 时去重并剔除空值', async () => {
    const { svc } = makeService(
      [myBook, sharedBook],
      [
        { userId: ME, accountBookId: 'b_shared', canViewBook: true },
        { userId: ME, accountBookId: 'b_shared', canViewBook: true },
        { userId: ME, accountBookId: '', canViewBook: true },
        { userId: OTHER, accountBookId: 'b_other_only', canViewBook: true },
      ],
    );
    const { items } = await svc.findAll(ME);
    expect(items.map((b: any) => b.id).sort()).toEqual(['b_mine', 'b_shared']);
  });
});
