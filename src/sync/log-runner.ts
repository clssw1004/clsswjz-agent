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
  }
}
