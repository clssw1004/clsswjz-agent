import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ConnectionManager } from '../core/connection-manager';
import { ItemRelation } from '../entities/item-relation.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/**
 * 账目关联（对齐 gui ItemRelationProvider / ItemRelationCULog）。
 * 记事关联账目：relationCode='note'、relationId=note.id，itemId 指向被关联账目。
 */
@Injectable()
export class ItemRelationService {
  constructor(private connMgr: ConnectionManager) {}

  /** 查询某业务记录（如 note）关联的账目，附带账目展示信息（分类名/金额/类型/描述） */
  async findBySource(userId: string, relationCode: string, relationId: string) {
    const relRepo = await this.connMgr.getRepository(userId, ItemRelation);
    const rels = await relRepo.find({
      where: { relationCode, relationId },
      order: { createdAt: 'DESC' },
    });
    if (!rels.length) return [];
    return this.decorateItems(userId, rels);
  }

  async create(userId: string, data: {
    itemId: string;
    accountBookId: string;
    relationCode: string;
    relationId: string;
  }) {
    const relRepo = await this.connMgr.getRepository(userId, ItemRelation);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const rel = relRepo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await relRepo.save(rel as any);
    const log = logRepo.create({
      businessType: BusinessType.ITEM_RELATION,
      operateType: OperateType.CREATE,
      parentType: 'book',
      parentId: data.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      // 协议对齐 gui ItemRelationTable.toJsonString：id/createdAt/updatedAt/createdBy/updatedBy/itemId/accountBookId/relationCode/relationId
      operateData: JSON.stringify(saved),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    const decorated = await this.decorateItems(userId, [saved]);
    return decorated[0];
  }

  async remove(userId: string, id: string) {
    const relRepo = await this.connMgr.getRepository(userId, ItemRelation);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const rel = await relRepo.findOneBy({ id });
    await relRepo.delete(id);
    if (rel) {
      const log = logRepo.create({
        businessType: BusinessType.ITEM_RELATION,
        operateType: OperateType.DELETE,
        parentType: 'book',
        parentId: rel.accountBookId,
        operatorId: userId,
        operatedAt: Date.now(),
        businessId: id,
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      } as any);
      await logRepo.save(log as any);
    }
    return { deleted: true };
  }

  /** 给关联记录附加账目展示信息（分类名 / 金额 / 类型 / 描述） */
  private async decorateItems(userId: string, rels: ItemRelation[]) {
    const itemRepo = await this.connMgr.getRepository(userId, AccountItem);
    const catRepo = await this.connMgr.getRepository(userId, AccountCategory);

    const itemIds = [...new Set(rels.map((r) => r.itemId))];
    const items = await itemRepo.find({ where: { id: In(itemIds) } });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // 分类名映射（key: `${accountBookId}:${code}`，账本隔离避免跨账本撞 code）
    const bookIds = [...new Set(items.map((i) => i.accountBookId))];
    const codes = [...new Set(items.map((i) => i.categoryCode).filter(Boolean))] as string[];
    const catMap = new Map<string, string>();
    if (codes.length) {
      const cats = await catRepo.find({ where: { code: In(codes), accountBookId: In(bookIds) } });
      for (const c of cats) catMap.set(`${c.accountBookId}:${c.code}`, c.name);
    }

    return rels.map((rel) => {
      const item = itemMap.get(rel.itemId);
      return {
        ...rel,
        item: item
          ? {
              id: item.id,
              type: item.type,
              amount: Number(item.amount),
              description: item.description ?? '',
              accountDate: item.accountDate,
              categoryName: item.categoryCode
                ? catMap.get(`${item.accountBookId}:${item.categoryCode}`) || null
                : null,
            }
          : null,
      };
    });
  }
}
