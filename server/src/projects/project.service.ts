import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountSymbol } from '../entities/account-symbol.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

const PROJECT_TYPE = 'PROJECT';

@Injectable()
export class ProjectService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { accountBookId?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const where: any = { symbolType: PROJECT_TYPE };
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    return repo.find({ where });
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountSymbol>) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const project = repo.create({ ...data, symbolType: PROJECT_TYPE, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(project as any);
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
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

  async update(userId: string, id: string, data: Partial<AccountSymbol>) {
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    delete data.symbolType;
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
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
    const repo = await this.connMgr.getRepository(userId, AccountSymbol);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const project = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.SYMBOL,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: project?.accountBookId,
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
