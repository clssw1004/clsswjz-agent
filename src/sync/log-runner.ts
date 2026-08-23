import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { AccountBook } from '../entities/account-book.entity';
import { AccountItem } from '../entities/account-item.entity';
import { AccountCategory } from '../entities/account-category.entity';
import { AccountFund } from '../entities/account-fund.entity';
import { AccountShop } from '../entities/account-shop.entity';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { AccountNote } from '../entities/account-note.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { AttachmentEntity } from '../entities/attachment.entity';
import { ItemRelField } from '../entities/item-rel-field.entity';

const TYPE_MAP: Record<string, any> = {
  [BusinessType.BOOK]: AccountBook,
  [BusinessType.ITEM]: AccountItem,
  [BusinessType.CATEGORY]: AccountCategory,
  [BusinessType.FUND]: AccountFund,
  [BusinessType.SHOP]: AccountShop,
  [BusinessType.SYMBOL]: AccountSymbol,
  [BusinessType.NOTE]: AccountNote,
  [BusinessType.BOOK_MEMBER]: AccountBookUser,
  [BusinessType.ATTACHMENT]: AttachmentEntity,
};

/** 标签关联字段 code（对齐移动端 item_rel_field fieldCode='TAG'） */
const TAG_FIELD = 'TAG';

@Injectable()
export class LogRunner {
  private sanitize(data: any, repo: Repository<any>): any {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    const cols = new Set(repo.metadata.columns.map((c: any) => c.propertyName));
    const out: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (cols.has(k)) out[k] = v;
    }
    return out;
  }

  async runLogSync(log: LogSync, ds: DataSource): Promise<void> {
    const EntityClass = TYPE_MAP[log.businessType];
    if (!EntityClass) return;
    const repo = ds.getRepository(EntityClass);
    const data = log.operateData ? JSON.parse(log.operateData) : null;
    switch (log.operateType) {
      case OperateType.CREATE:
        if (data) await repo.save(this.sanitize(data, repo));
        break;
      case OperateType.BATCH_CREATE:
        if (Array.isArray(data)) {
          for (const row of data) await repo.save(this.sanitize(row, repo));
        } else if (data) {
          await repo.save(this.sanitize(data, repo));
        }
        break;
      case OperateType.UPDATE:
        if (data) {
          const { id, ...fields } = data;
          const clean = this.sanitize(fields, repo);
          // 无业务 id 的更新无法定位记录（历史脏日志：touch 型 update 只带 updatedAt/updatedBy），跳过
          if (log.businessId && Object.keys(clean).length > 0) await repo.update(log.businessId, clean);
        }
        break;
      case OperateType.DELETE:
        if (log.businessId) await repo.delete(log.businessId);
        break;
      case OperateType.BATCH_DELETE:
        if (Array.isArray(data?.ids) && data.ids.length > 0) await repo.delete(data.ids);
        else if (log.businessId) await repo.delete(log.businessId);
        break;
      case OperateType.BATCH_UPDATE:
        if (Array.isArray(data)) {
          for (const row of data) {
            const { id, ...fields } = row;
            const clean = this.sanitize(fields, repo);
            if (id && Object.keys(clean).length > 0) await repo.update(id, clean);
          }
        } else if (Array.isArray(data?.ids) && Array.isArray(data.data)) {
          for (let i = 0; i < data.ids.length; i++) {
            if (!data.ids[i]) continue;
            const fields = typeof data.data[i] === 'object' ? data.data[i] : {};
            const clean = this.sanitize(fields, repo);
            if (Object.keys(clean).length > 0) await repo.update(data.ids[i], clean);
          }
        }
        break;
    }
    // ITEM 多标签关联（单独表 item_rel_field，tagCode 仅为历史兼容）
    if (log.businessType === BusinessType.ITEM) {
      await this.syncItemTags(log, ds, data);
    }
  }

  /**
   * 维护 item 的多标签关联（对齐移动端：标签存 item_rel_field，fieldCode='TAG'）。
   * - CREATE/UPDATE：operateData 显式含 tagCodes（或兼容 tagCode）时，先删后插；
   *   未显式携带标签字段的部分更新不动关联（避免误删）。
   * - DELETE/BATCH_DELETE：清理该 item 的全部关联。
   */
  private async syncItemTags(log: LogSync, ds: DataSource, data: any): Promise<void> {
    const relRepo = ds.getRepository(ItemRelField);
    const itemRepo = ds.getRepository(AccountItem);
    const extract = (d: any): string[] | null => {
      if (!d || typeof d !== 'object') return null;
      if (Array.isArray(d.tagCodes)) return d.tagCodes.filter((c: any) => typeof c === 'string' && c);
      if (typeof d.tagCode === 'string' && d.tagCode) return [d.tagCode];
      return null;
    };

    switch (log.operateType) {
      case OperateType.CREATE:
      case OperateType.BATCH_CREATE: {
        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          const codes = extract(row);
          if (codes === null) continue;
          const itemId = row?.id ?? log.businessId;
          if (!itemId) continue;
          await relRepo.delete({ itemId, fieldCode: TAG_FIELD });
          for (let i = 0; i < codes.length; i++) {
            await relRepo.save(relRepo.create({ itemId, fieldCode: TAG_FIELD, fieldValue: codes[i], sortOrder: i } as any) as any);
          }
          // 兼容字段回填：多标签首值写入 item.tagCode（服务端/旧端依赖）
          if (codes.length && !row.tagCode) {
            await itemRepo.update(itemId, { tagCode: codes[0] } as any);
          }
        }
        break;
      }
      case OperateType.UPDATE:
      case OperateType.BATCH_UPDATE: {
        const rows = Array.isArray(data) ? data : [data];
        const ids = Array.isArray(data) ? undefined : data?.ids;
        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const codes = extract(row);
          if (codes === null) continue;
          const itemId = (ids && ids[idx]) || row?.id || log.businessId;
          if (!itemId) continue;
          await relRepo.delete({ itemId, fieldCode: TAG_FIELD });
          for (let i = 0; i < codes.length; i++) {
            await relRepo.save(relRepo.create({ itemId, fieldCode: TAG_FIELD, fieldValue: codes[i], sortOrder: i } as any) as any);
          }
          if (codes.length && !row.tagCode) {
            await itemRepo.update(itemId, { tagCode: codes[0] } as any);
          }
        }
        break;
      }
      case OperateType.DELETE: {
        if (log.businessId) await relRepo.delete({ itemId: log.businessId });
        break;
      }
      case OperateType.BATCH_DELETE: {
        const ids = Array.isArray(data?.ids) ? data.ids : [];
        for (const id of ids) {
          await relRepo.delete({ itemId: id });
        }
        if (log.businessId && !ids.includes(log.businessId)) {
          await relRepo.delete({ itemId: log.businessId });
        }
        break;
      }
    }
  }
}
