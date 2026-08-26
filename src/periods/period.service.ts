import { Injectable } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { PeriodCycle } from '../entities/period-cycle.entity';
import { PeriodDailyRecord } from '../entities/period-daily-record.entity';
import { UserShare } from '../entities/user-share.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class PeriodService {
  constructor(private connMgr: ConnectionManager) {}

  /**
   * 共享给我的周期数据 owner 列表（对齐 gui _getPeriodSharedBy）：
   * periodCycle 或 periodDailyRecord 任一共享即视为可见
   */
  private async getSharedOwners(userId: string): Promise<string[]> {
    const shareRepo = await this.connMgr.getRepository(userId, UserShare);
    const shares = await shareRepo.find({ where: { targetUserId: userId, isEnabled: true } });
    return [...new Set(
      shares
        .filter((s) => s.ownerUserId !== userId)
        .filter((s) => s.businessType === 'periodCycle' || s.businessType === 'periodDailyRecord')
        .map((s) => s.ownerUserId),
    )];
  }

  async listCycles(userId: string, query: { recent?: number; all?: boolean; active?: boolean; year?: number; month?: number }) {
    const repo = await this.connMgr.getRepository(userId, PeriodCycle);
    // 可见范围 = 自己创建 + 共享给我的人创建（对齐 gui findByCreatorOrShared）
    const sharedOwners = await this.getSharedOwners(userId);
    const qb = repo.createQueryBuilder('c')
      .where('c.createdBy IN (:...owners)', { owners: [userId, ...sharedOwners] })
      .orderBy('c.startDate', 'DESC');
    const all = await qb.getMany();

    if (query.active) {
      const mineActive = all.filter((c) => !c.endDate);
      // 活跃周期只取自己的（共享方的"进行中"不作为本地操作依据）
      return mineActive.filter((c) => c.createdBy === userId).slice(0, 1);
    }
    if (query.all) return all;
    if (query.recent) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - query.recent);
      const cutoffStr = this.fmtDate(cutoff);
      return all.filter((c) => !c.endDate || c.endDate >= cutoffStr);
    }
    if (query.year && query.month) {
      const prefix = `${query.year}-${String(query.month).padStart(2, '0')}`;
      const monthStart = `${prefix}-01`;
      const lastDay = new Date(query.year, query.month, 0).getDate();
      const monthEnd = `${prefix}-${String(lastDay).padStart(2, '0')}`;
      return all.filter((c) => c.startDate <= monthEnd && (!c.endDate || c.endDate >= monthStart));
    }
    return all;
  }

  async createCycle(userId: string, data: { startDate: string; endDate?: string; typicalPeriodDays?: number; typicalCycleDays?: number }) {
    const repo = await this.connMgr.getRepository(userId, PeriodCycle);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const cycle = repo.create({
      startDate: data.startDate, endDate: data.endDate || null,
      typicalPeriodDays: data.typicalPeriodDays || null, typicalCycleDays: data.typicalCycleDays || null,
      createdBy: userId, updatedBy: userId,
    } as any);
    const saved = await repo.save(cycle as any);
    await this.writeLog(logRepo, BusinessType.PERIOD_CYCLE, OperateType.CREATE, userId, saved.id, saved);
    return saved;
  }

  async updateCycleEnd(userId: string, cycleId: string, endDate: string) {
    const repo = await this.connMgr.getRepository(userId, PeriodCycle);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const cycle = await repo.findOneBy({ id: cycleId });
    if (!cycle || cycle.createdBy !== userId) return null; // 只能操作自己创建的周期
    await repo.update(cycleId, { endDate, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id: cycleId });
    if (updated) await this.writeLog(logRepo, BusinessType.PERIOD_CYCLE, OperateType.UPDATE, userId, cycleId, updated);
    return updated;
  }

  async deleteCycle(userId: string, cycleId: string) {
    const repo = await this.connMgr.getRepository(userId, PeriodCycle);
    const recRepo = await this.connMgr.getRepository(userId, PeriodDailyRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const cycle = await repo.findOneBy({ id: cycleId });
    if (!cycle || cycle.createdBy !== userId) return { deleted: false }; // 只能删除自己的
    await recRepo.delete({ cycleId } as any);
    await repo.delete(cycleId);
    await this.writeLog(logRepo, BusinessType.PERIOD_CYCLE, OperateType.DELETE, userId, cycleId, { id: cycleId });
    return { deleted: true };
  }

  async listDailyRecords(userId: string, cycleId: string) {
    const repo = await this.connMgr.getRepository(userId, PeriodDailyRecord);
    return repo.find({ where: { cycleId } as any, order: { recordDate: 'ASC' } });
  }

  async upsertDailyRecord(userId: string, cycleId: string, data: {
    recordDate: string; flowLevel?: string; symptoms?: string; mood?: string; remark?: string;
  }) {
    const cycleRepo = await this.connMgr.getRepository(userId, PeriodCycle);
    const cycle = await cycleRepo.findOneBy({ id: cycleId });
    if (!cycle || cycle.createdBy !== userId) return null; // 只能给自己的周期记明细
    const repo = await this.connMgr.getRepository(userId, PeriodDailyRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const existing = await repo.findOne({ where: { cycleId, recordDate: data.recordDate } as any });
    if (existing) {
      await repo.update(existing.id, {
        flowLevel: data.flowLevel ?? existing.flowLevel, symptoms: data.symptoms ?? existing.symptoms,
        mood: data.mood ?? existing.mood, remark: data.remark ?? existing.remark, updatedBy: userId,
      } as any);
      const updated = await repo.findOneBy({ id: existing.id });
      if (updated) await this.writeLog(logRepo, BusinessType.PERIOD_DAILY_RECORD, OperateType.UPDATE, userId, updated.id, updated);
      return updated;
    }
    const record = repo.create({
      cycleId, recordDate: data.recordDate, flowLevel: data.flowLevel || 'none',
      symptoms: data.symptoms || '[]', mood: data.mood || 'normal', remark: data.remark || null,
      createdBy: userId, updatedBy: userId,
    } as any);
    const saved = await repo.save(record as any);
    await this.writeLog(logRepo, BusinessType.PERIOD_DAILY_RECORD, OperateType.CREATE, userId, saved.id, saved);
    return saved;
  }

  async deleteDailyRecord(userId: string, cycleId: string, recordDate: string) {
    const cycleRepo = await this.connMgr.getRepository(userId, PeriodCycle);
    const cycle = await cycleRepo.findOneBy({ id: cycleId });
    if (!cycle || cycle.createdBy !== userId) return { deleted: false }; // 只能删除自己周期内的明细
    const repo = await this.connMgr.getRepository(userId, PeriodDailyRecord);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const existing = await repo.findOne({ where: { cycleId, recordDate } as any });
    if (existing) {
      await repo.delete(existing.id);
      await this.writeLog(logRepo, BusinessType.PERIOD_DAILY_RECORD, OperateType.DELETE, userId, existing.id, { id: existing.id });
    }
    return { deleted: true };
  }

  private async writeLog(logRepo: any, businessType: BusinessType, operateType: OperateType, userId: string, businessId: string, data: any) {
    const log = logRepo.create({
      businessType, operateType, parentType: 'root', parentId: 'None',
      operatorId: userId, operatedAt: Date.now(), businessId,
      operateData: JSON.stringify(data), syncState: SyncState.UNSYNCED, syncTime: -1,
    } as any);
    await logRepo.save(log as any);
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
