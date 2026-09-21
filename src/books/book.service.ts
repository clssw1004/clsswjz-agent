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
      // 作用域字段对齐 gui：BookCULog.create 在 insert 后 inBook(data.id)，
      // 即 parentType='book'、parentId=businessId=新账本 id。写 'root' 会让主端的
      // 账本权限门（parentType === 'book' 才校验 canOperateBook）整段跳过。
      parentType: 'book',
      parentId: saved.id,
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
      // gui 回放账本 update 是唯一用 parentId 定位记录的类型
      // （book.builder.dart: BookCULog.executeLog → bookDao.update(parentId!, data!)），
      // parentId 写错等于这次改名在手机端静默丢失；同时主端拉取可见性要求
      // parent_type='book' 才对同账本其他成员可见。
      parentType: 'book',
      parentId: id,
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
      // 同 update：parentId 交给主端做账本权限校验（gui BookDLog 也 inBook(bookId)）
      parentType: 'book',
      parentId: id,
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
