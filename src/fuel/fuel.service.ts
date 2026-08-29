import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { FuelRecord } from '../entities/fuel-record.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class FuelService {
  constructor(private connMgr: ConnectionManager) {}

  async findAll(userId: string, query: { vehicleId?: string } = {}) {
    const repo = await this.connMgr.getRepository(userId, FuelRecord);
    const where: any = {};
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    return repo.find({ where });
  }

  async findOne(userId: string, id: string) {
    const repo = await this.connMgr.getRepository(userId, FuelRecord);
    return repo.findOneBy({ id });
  }

  async create(userId: string, data: Partial<FuelRecord>) {
    const repo = await this.connMgr.getRepository(userId, FuelRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const record = repo.create({ ...data, createdBy: userId, updatedBy: userId } as any);
    const saved = await repo.save(record as any);
    const log = logRepo.create({
      businessType: BusinessType.FUEL_RECORD,
      operateType: OperateType.CREATE,
      parentType: '',
      parentId: '',
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

  async update(userId: string, id: string, data: Partial<FuelRecord>) {
    const repo = await this.connMgr.getRepository(userId, FuelRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(id, { ...data, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id });
    const log = logRepo.create({
      businessType: BusinessType.FUEL_RECORD,
      operateType: OperateType.UPDATE,
      parentType: '',
      parentId: '',
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
    const repo = await this.connMgr.getRepository(userId, FuelRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const record = await repo.findOneBy({ id });
    await repo.delete(id);
    const log = logRepo.create({
      businessType: BusinessType.FUEL_RECORD,
      operateType: OperateType.DELETE,
      parentType: '',
      parentId: '',
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
