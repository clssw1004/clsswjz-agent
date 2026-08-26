import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConnectionManager } from '../core/connection-manager';
import { AppUser } from '../entities/app-user.entity';
import { AttachmentEntity } from '../entities/attachment.entity';
import { LogSync } from '../entities/log-sync.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Injectable()
export class UserService {
  constructor(private connMgr: ConnectionManager) {}

  /** 当前用户资料（对齐 gui getUserInfo；avatar 为附件 id） */
  async getProfile(userId: string) {
    const repo = await this.connMgr.getRepository(userId, AppUser);
    const user = await repo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || '',
      inviteCode: user.inviteCode,
      language: user.language,
      timezone: user.timezone,
    };
  }

  /**
   * 更新个人资料（昵称/邮箱/手机号/时区），写 USER UPDATE 日志同步到主端。
   * 对齐 gui UserCULog.update：operateData 只携带变更字段。
   */
  async updateProfile(
    userId: string,
    patch: { nickname?: string; email?: string; phone?: string; timezone?: string; language?: string },
  ) {
    const repo = await this.connMgr.getRepository(userId, AppUser);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const fields: Record<string, any> = {};
    for (const k of ['nickname', 'email', 'phone', 'timezone', 'language'] as const) {
      if (patch[k] !== undefined) fields[k] = patch[k];
    }
    if (!Object.keys(fields).length) return this.getProfile(userId);

    await repo.update(userId, { ...fields, updatedBy: userId } as any);
    const updated = await repo.findOneBy({ id: userId });

    const operateData = { ...fields, updatedAt: Date.now() };
    const log = logRepo.create({
      businessType: BusinessType.USER,
      operateType: OperateType.UPDATE,
      parentType: 'root',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: userId,
      operateData: JSON.stringify(operateData),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return updated ? this.stripSecrets(updated) : null;
  }

  /** 更新头像：上传附件（businessCode=user）+ 写 USER UPDATE 日志（avatar=附件id），对齐 gui AttachmentCULog.fromFile + UserCULog.update */
  async updateAvatar(userId: string, attachmentId: string) {
    const repo = await this.connMgr.getRepository(userId, AppUser);
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    await repo.update(userId, { avatar: attachmentId, updatedBy: userId } as any);

    const log = logRepo.create({
      businessType: BusinessType.USER,
      operateType: OperateType.UPDATE,
      parentType: 'root',
      parentId: 'None',
      operatorId: userId,
      operatedAt: Date.now(),
      businessId: userId,
      operateData: JSON.stringify({ avatar: attachmentId, updatedAt: Date.now() }),
      syncState: SyncState.UNSYNCED,
      syncTime: -1,
    } as any);
    await logRepo.save(log as any);
    return { avatar: attachmentId };
  }

  /** 头像等展示场景：脱敏（对齐 server desensitize 策略，本接口只服务自己所以保留原文，但绝不返回 password） */
  private stripSecrets(user: AppUser) {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || '',
      inviteCode: user.inviteCode,
      language: user.language,
      timezone: user.timezone,
    };
  }
}
