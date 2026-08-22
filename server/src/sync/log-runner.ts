import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  async runLogSync(log: LogSync, ds: DataSource): Promise<void> {
    const EntityClass = TYPE_MAP[log.businessType];
    if (!EntityClass) return;
    const repo = ds.getRepository(EntityClass);
    const data = log.operateData ? JSON.parse(log.operateData) : null;
    switch (log.operateType) {
      case OperateType.CREATE:
      case OperateType.BATCH_CREATE:
        if (data) await repo.save(data);
        break;
      case OperateType.UPDATE:
        if (data) { const { id, ...fields } = data; await repo.update(log.businessId, fields); }
        break;
      case OperateType.DELETE:
        await repo.delete(log.businessId);
        break;
      case OperateType.BATCH_DELETE:
        if (data?.ids) await repo.delete(data.ids);
        else await repo.delete(log.businessId);
        break;
    }
  }
}
