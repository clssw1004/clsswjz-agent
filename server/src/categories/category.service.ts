import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountCategory } from '../entities/account-category.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class CategoryService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { accountBookId?: string; categoryType?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountCategory);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    if (query.categoryType) where.categoryType = query.categoryType;
    return repo.find({ where });
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountCategory);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountCategory>) {
    const repo = await this.connMgr.getRepository(userId, AccountCategory);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const category = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(category as any);
    const log = logRepo.create({
      businessType: BusinessType.CATEGORY,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId,
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

  async update(userId: string, id: string, data: Partial<AccountCategory>) {
    const repo = await this.connMgr.getRepository(userId, AccountCategory);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.CATEGORY,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated?.accountBookId,
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
    const repo = await this.connMgr.getRepository(userId, AccountCategory);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const category = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.CATEGORY,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: category?.accountBookId,
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
