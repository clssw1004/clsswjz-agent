import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountItem } from '../entities/account-item.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class ItemService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: {
    accountBookId?: string; type?: string; page?: number; pageSize?: number;
    startDate?: string; endDate?: string;
  }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const { accountBookId, type, page = 1, pageSize = 20, startDate, endDate } = query;
    const qb = repo.createQueryBuilder('item');
    if (accountBookId) qb.andWhere('item.accountBookId = :accountBookId', { accountBookId });
    if (type) qb.andWhere('item.type = :type', { type });
    if (startDate) qb.andWhere('item.accountDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('item.accountDate <= :endDate', { endDate });
    const total = await qb.getCount();
    const items = await qb.orderBy('item.accountDate', 'DESC')
      .skip((page - 1) * pageSize).take(pageSize).getMany();
    return { items, total, page, pageSize };
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountItem>) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const item = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(item as any);
    const log = logRepo.create({
      businessType: BusinessType.ITEM,
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

  async update(userId: string, id: string, data: Partial<AccountItem>) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.ITEM,
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
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const item = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: item?.accountBookId,
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
