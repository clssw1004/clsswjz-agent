import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { ActivityDefinition } from '../entities/activity-definition.entity';
import { ActivityRecord } from '../entities/activity-record.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class ActivityService {
  constructor(private connMgr: ConnectionManager) {}

  /* ---------- ActivityDefinition (BusinessType.ACTIVITY_DEFINITION) ---------- */

  async findAllDefinitions(userId: string, query: { accountBookId?: string }) {
    const repo = await this.connMgr.getRepository(userId, ActivityDefinition);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    return repo.find({ where, order: { sortOrder: 'ASC' } as any });
  }

  async findOneDefinition(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, ActivityDefinition);
    return repo.findOneBy({ id });
  }

  async createDefinition(userId: string, data: Partial<ActivityDefinition>) {
    const repo = await this.connMgr.getRepository(userId, ActivityDefinition);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const def = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(def as any);
    const log = logRepo.create({
      businessType: BusinessType.ACTIVITY_DEFINITION,
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

  async updateDefinition(userId: string, id: string, data: Partial<ActivityDefinition>) {
    const repo = await this.connMgr.getRepository(userId, ActivityDefinition);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.ACTIVITY_DEFINITION,
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

  async removeDefinition(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, ActivityDefinition);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const def = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.ACTIVITY_DEFINITION,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: def?.accountBookId,
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: id,
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return { deleted: true };
  }

  /* ---------- ActivityRecord (BusinessType.ACTIVITY) ---------- */

  async findAllRecords(
    userId: string,
    query: { accountBookId?: string; activityDefId?: string; date?: string },
  ) {
    const repo = await this.connMgr.getRepository(userId, ActivityRecord);
    const where: any = {};
    if (query.accountBookId) where.accountBookId = query.accountBookId;
    if (query.activityDefId) where.activityDefId = query.activityDefId;
    if (query.date) where.recordDate = query.date;
    return repo.find({ where, order: { recordDate: 'DESC' } as any });
  }

  async createRecord(userId: string, data: Partial<ActivityRecord>) {
    const repo = await this.connMgr.getRepository(userId, ActivityRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const record = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(record as any);
    const log = logRepo.create({
      businessType: BusinessType.ACTIVITY,
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

  async removeRecord(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, ActivityRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const record = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.ACTIVITY,
      operateType: OperateType.DELETE,
      parentType: 'book',
      parentId: record?.accountBookId,
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
