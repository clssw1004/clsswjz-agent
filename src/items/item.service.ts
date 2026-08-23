import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountItem } from '../entities/account-item.entity';
import { ItemRelField } from '../entities/item-rel-field.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/** 标签关联字段 code（对齐移动端 book_item.builder.dart fieldCode: 'TAG'） */
const TAG_FIELD = 'TAG';

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
    await this.attachTags(userId, items);
    return { items, total, page, pageSize };
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const item = await repo.findOneBy({ id });
    if (item) await this.attachTags(userId, [item]);
    return item;
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

  async create(userId: string, data: Partial<AccountItem> & { tagCodes?: string[] }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    // 多标签数组（tagCodes）为事实来源；tagCode 单值仅作历史兼容
    const tagCodes = Array.isArray(data.tagCodes) ? data.tagCodes.filter(Boolean) : [];
    const { tagCodes: _drop, ...rest } = data as any;
    const tagCode = rest.tagCode || tagCodes[0] || undefined;
    const item = repo.create({ ...rest, tagCode, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(item as any);
    if (tagCodes.length) {
      await this.replaceTags(userId, saved.id, tagCodes);
    }
    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      // 协议对齐移动端：operateData 含 tagCodes 数组（移动端优先读它，tagCode 仅兼容）
      operateData: JSON.stringify({ ...saved, tagCodes: tagCodes.length ? tagCodes : undefined }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return saved;
  }

  async update(userId: string, id: string, data: Partial<AccountItem> & { tagCodes?: string[] }) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const { tagCodes: rawTagCodes, ...fields } = data as any;
    if (rawTagCodes !== undefined) {
      const tagCodes = Array.isArray(rawTagCodes) ? rawTagCodes.filter(Boolean) : [];
      if (fields.tagCode === undefined) fields.tagCode = tagCodes[0] || null;
      await this.replaceTags(userId, id, tagCodes);
    }
    await repo.update(id, { ...fields, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    if (updated) await this.attachTags(userId, [updated]);
    const log = logRepo.create({
      businessType: BusinessType.ITEM,
      operateType: OperateType.UPDATE,
      parentType: 'book',
      parentId: updated?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      operateData: JSON.stringify({
        id,
        ...fields,
        tagCode: fields.tagCode ?? updated?.tagCode ?? null,
        tagCodes: Array.isArray(rawTagCodes) && rawTagCodes.filter(Boolean).length
          ? rawTagCodes.filter(Boolean)
          : undefined,
      }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated;
  }

  async remove(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountItem);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const relRepo = await this.connMgr.getRepository(userId, ItemRelField);
    const item = await repo.findOneBy({ id });
    await repo.delete(id);
    await relRepo.delete({ itemId: id });
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

  /** 全量替换某 item 的标签关联（先删后插） */
  private async replaceTags(userId: string, itemId: string, codes: string[]) {
    const relRepo = await this.connMgr.getRepository(userId, ItemRelField);
    await relRepo.delete({ itemId, fieldCode: TAG_FIELD });
    for (let i = 0; i < codes.length; i++) {
      const row = relRepo.create({
        itemId,
        fieldCode: TAG_FIELD,
        fieldValue: codes[i],
        sortOrder: i,
      } as any);
      await relRepo.save(row as any);
    }
  }

  /** 给账目附加 tags（多标签 code 数组，来自 item_rel_field） */
  private async attachTags(userId: string, items: AccountItem[]) {
    if (!items.length) return;
    const relRepo = await this.connMgr.getRepository(userId, ItemRelField);
    const rels = await relRepo.find({ where: { fieldCode: TAG_FIELD }, order: { sortOrder: 'ASC' } });
    const byItem = new Map<string, string[]>();
    for (const r of rels) {
      const arr = byItem.get(r.itemId) || [];
      arr.push(r.fieldValue);
      byItem.set(r.itemId, arr);
    }
    for (const it of items) {
      (it as any).tags = byItem.get(it.id) || [];
    }
  }
}
