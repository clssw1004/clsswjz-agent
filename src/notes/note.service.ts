import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AccountNote } from '../entities/account-note.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class NoteService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { accountBookId?: string; noteType?: string; groupCode?: string }) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    if (query.noteType) where.noteType = query.noteType;
    if (query.groupCode) where.groupCode = query.groupCode;
    return repo.find({ where });
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<AccountNote>) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const note = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(note as any);
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
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

  async update(userId: string, id: string, data: Partial<AccountNote>) {
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
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
    const repo = await this.connMgr.getRepository(userId, AccountNote);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const note = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.NOTE,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: note?.accountBookId,
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
