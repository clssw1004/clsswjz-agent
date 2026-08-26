import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { UserShare } from '../entities/user-share.entity';
import { AppUser } from '../entities/app-user.entity';
import { AccountBookUser } from '../entities/account-book-user.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

/** 经期模块联动共享的两个 businessType（对齐 GUI share_settings_page 联动逻辑） */
const PERIOD_LINKED_TYPES = ['periodCycle', 'periodDailyRecord'];

@Injectable()
export class UserShareService {
  private readonly logger = new Logger(UserShareService.name);

  constructor(private connMgr: ConnectionManager) {}

  /** 我的共享配置（owner=me），含被共享配置与可选用户 */
  async findAll(userId: string) {
    const repo = await this.connMgr.getRepository(userId, UserShare);
    const [myShares, sharedToMe] = await Promise.all([
      repo.find({ where: { ownerUserId: userId } }),
      repo.find({ where: { targetUserId: userId, isEnabled: true } }),
    ]);
    return { myShares, sharedToMe };
  }

  /** 可选共享目标：同账本成员（排除自己），对齐 gui findSelectableRecipients */
  async listEligibleUsers(userId: string) {
    const memberRepo = await this.connMgr.getRepository(userId, AccountBookUser);
    const userRepo = await this.connMgr.getRepository(userId, AppUser);
    const myBooks = await memberRepo.find({ where: { userId } });
    if (!myBooks.length) return [];
    const bookIds = [...new Set(myBooks.map((m) => m.accountBookId))];
    const qb = memberRepo.createQueryBuilder('m')
      .select('DISTINCT m.userId', 'userId')
      .where('m.accountBookId IN (:...bookIds)', { bookIds })
      .andWhere('m.userId != :userId', { userId });
    const rows = await qb.getRawMany();
    const ids = rows.map((r) => r.userId).filter(Boolean);
    if (!ids.length) return [];
    const users = await userRepo.findByIds(ids);
    // 脱敏：只暴露昵称（对齐 server 端 desensitize 策略）
    return users.map((u) => ({ id: u.id, nickname: u.nickname || u.username }));
  }

  /**
   * 设置共享开关（upsert by owner+target+businessType 唯一键）。
   * periodCycle 开关联动 periodDailyRecord（对齐 GUI）。
   */
  async setShare(
    userId: string,
    data: { targetUserId: string; businessType: string; isEnabled: boolean },
  ) {
    const types = data.businessType === 'periodCycle'
      ? PERIOD_LINKED_TYPES
      : [data.businessType];
    for (const t of types) {
      await this.upsertOne(userId, data.targetUserId, t, data.isEnabled);
    }
    return { ok: true };
  }

  private async upsertOne(userId: string, targetUserId: string, businessType: string, isEnabled: boolean) {
    const repo = await this.connMgr.getRepository(userId, UserShare);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    let row = await repo.findOne({ where: { ownerUserId: userId, targetUserId, businessType } });
    let saved: UserShare;
    if (row) {
      await repo.update(row.id, { isEnabled, updatedBy: userId } as any);
      saved = (await repo.findOneBy({ id: row.id }))!;
    } else {
      const created = repo.create({
        ownerUserId: userId, targetUserId, businessType, isEnabled,
        createdBy: userId, updatedBy: userId,
      } as any);
      saved = await repo.save(created as any);
    }
    const log = logRepo.create({
      businessType: BusinessType.USER_SHARE,
      operateType: OperateType.UPDATE,
      parentType: 'root', parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: saved.id,
      operateData: JSON.stringify(saved),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
  }

  /** 移除某目标的全部共享（删除行 + 写 DELETE 日志，对齐 GUI _removeUser 遍历关闭） */
  async removeAllForTarget(userId: string, targetUserId: string) {
    const repo = await this.connMgr.getRepository(userId, UserShare);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const rows = await repo.find({ where: { ownerUserId: userId, targetUserId } });
    for (const row of rows) {
      await repo.delete(row.id);
      const log = logRepo.create({
        businessType: BusinessType.USER_SHARE,
        operateType: OperateType.DELETE,
        parentType: 'root', parentId: 'None',
        operatorId: userId,
        operatedAt: Date.now(),
        businessId: row.id,
        operateData: JSON.stringify({ id: row.id, ownerUserId: row.ownerUserId, targetUserId, businessType: row.businessType }),
        syncState: SyncState.UNSYNCED,
        syncTime: -1,
      } as any);
      await logRepo.save(log as any);
    }
    return { deleted: rows.length };
  }
}
