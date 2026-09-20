import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ConnectionManager } from '../core/connection-manager';
import { AccountBook } from '../entities/account-book.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class BookService {
  constructor(private connMgr: ConnectionManager) {}

  /**
   * 可见账本列表 = **自己创建的账本 ∪ 他人共享给我且可查看的账本**。
   *
   * 权限对齐两处基准：
   * - gui `BookDao.findPermissionedByUserId`：join `rel_accountbook_user` 且 `canViewBook = true`
   * - 主端 `SyncService.getMyBookIds`：`account_books.created_by` ∪ `rel_accountbook_user.user_id`
   *   （主端 pull 的数据可见范围也按这个集合下发）
   *
   * 原实现只写 `where: { createdBy: userId }`，把「别人创建、共享给我」的账本整个漏掉，
   * 表现为被共享方登录后账本列表为空。用 createdBy 兜底是因为本地库是服务端物化视图：
   * 缺关系行意味着同步未覆盖，而不是权限被撤销，不能因此让自己的账本消失。
   */
  async findAll(userId: string) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    const relRepo = await this.connMgr.getRepository(userId, AccountBookUser);
    const rels = await relRepo.find({
      where: { userId, canViewBook: true },
      select: ['accountBookId'],
    });
    const sharedIds = [
      ...new Set(rels.map((r) => r.accountBookId).filter((id) => !!id)),
    ];
    const [items, total] = await repo.findAndCount({
      where: sharedIds.length
        ? [{ createdBy: userId }, { id: In(sharedIds) }]
        : { createdBy: userId },
    });
    return { items, total };
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountBook>) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const book = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(book as any);
    const log = logRepo.create({
      businessType: BusinessType.BOOK,
      operateType: OperateType.CREATE,
      parentType: 'root',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      operateData: JSON.stringify(saved),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return saved;
  }

  async update(userId: string, id: string, data: Partial<AccountBook>) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.BOOK,
      operateType: OperateType.UPDATE,
      parentType: 'root',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify({ id, ...data }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated;
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.BOOK,
      operateType: OperateType.DELETE,
      parentType: 'root',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return { deleted: true };
  }
}
