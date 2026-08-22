import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountBook } from '../entities/account-book.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class BookService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string) {
    const repo = await this.connMgr.getRepository(userId, AccountBook);
    const [items, total] = await repo.findAndCount({ where: { createdBy: userId } });
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
