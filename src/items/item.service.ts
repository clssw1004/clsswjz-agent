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

  /** 收支聚合（只读统计，供首页统计卡；不影响同步协议） */
  async summary(userId: string, query: {
    accountBookId?: string; startDate?: string; endDate?: string;
  }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const qb = repo.createQueryBuilder('item');
    if (query.accountBookId) qb.andWhere('item.accountBookId = :accountBookId', { accountBookId: query.accountBookId });
    if (query.startDate) qb.andWhere('item.accountDate >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('item.accountDate <= :endDate', { endDate: query.endDate });
    const rows = await qb
      .select('item.type', 'type')
      .addSelect('SUM(item.amount)', 'total')
      .groupBy('item.type')
      .getRawMany();
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      if (r.type === 'INCOME') income = Number(r.total || 0);
      else expense = Number(r.total || 0);
    }
    return { income, expense, balance: income + expense };
  }

  /** 按分类聚合（只读统计，供统计页分类占比；不影响同步协议） */
  async statistics(userId: string, query: {
    accountBookId?: string; startDate?: string; endDate?: string;
  }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const qb = repo.createQueryBuilder('item');
    if (query.accountBookId) qb.andWhere('item.accountBookId = :accountBookId', { accountBookId: query.accountBookId });
    if (query.startDate) qb.andWhere('item.accountDate >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('item.accountDate <= :endDate', { endDate: query.endDate });
    const rows = await qb
      .select('item.categoryCode', 'categoryCode')
      .addSelect('item.type', 'type')
      .addSelect('SUM(item.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('item.categoryCode')
      .addGroupBy('item.type')
      .getRawMany();
    const byCategory = rows
      .filter((r) => r.categoryCode && r.total)
      .map((r) => ({
        categoryCode: r.categoryCode,
        type: r.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        total: Number(r.total || 0),
        count: Number(r.count || 0),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    return { byCategory };
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
