import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ConnectionManager } from '../core/connection-manager';
import { UserService } from '../meta/user.service';
import { LogSync } from '../entities/log-sync.entity';
import { SyncState } from '../enums/sync-state.enum';
import { MaterializeService } from './materialize.service';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private syncTimer: NodeJS.Timeout | null = null;
  private readonly syncingUsers = new Set<string>();
  // 每用户同步进度（对齐移动端 SyncProvider：syncing + currentStep + progress）
  private syncProgress = new Map<string, { syncing: boolean; step: string; percent: number }>();
  constructor(
    private connMgr: ConnectionManager,
    private userService: UserService,
    private materialize: MaterializeService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = Number(this.config.get('sync.interval')) || 0;
    if (interval > 0) {
      this.syncTimer = setInterval(() => this.syncAll(), interval);
      this.logger.log(`Auto-sync scheduler started (interval=${interval}ms)`);
    }
  }

  onModuleDestroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async syncAll() {
    let users;
    try {
      users = await this.userService.findAll();
    } catch (err) {
      this.logger.error(`Auto-sync failed to list users: ${err.message}`);
      return;
    }
    for (const user of users) {
      if (!user.mainServerUrl || !user.mainToken) continue;
      if (this.syncingUsers.has(user.id)) continue;
      this.syncingUsers.add(user.id);
      try {
        await this.push(user.id);
        await this.pull(user.id);
      } catch (err) {
        this.logger.warn(`Auto-sync failed for user ${user.id}: ${err.message}`);
      } finally {
        this.syncingUsers.delete(user.id);
      }
    }
  }

  isSyncing(userId: string) {
    return this.syncingUsers.has(userId);
  }

  /** 更新某用户的同步进度（步骤文案 + 百分比） */
  private setProgress(userId: string, step: string, percent: number) {
    this.syncProgress.set(userId, { syncing: true, step, percent });
  }

  /** 结束某用户的同步进度 */
  private clearProgress(userId: string) {
    this.syncProgress.delete(userId);
  }

  getProgress(userId: string) {
    return this.syncProgress.get(userId) || { syncing: false, step: '', percent: 0 };
  }

  /**
   * 完整同步一轮（push → pull → 物化），带进度上报。
   * 返回 { pushed, pulled }。
   */
  async syncWithProgress(userId: string): Promise<{ pushed: number; pulled: number }> {
    if (this.syncingUsers.has(userId)) return { pushed: 0, pulled: 0 };
    this.syncingUsers.add(userId);
    try {
      this.setProgress(userId, '检查服务端状态', 5);
      const pushed = await this.push(userId, (p) => this.setProgress(userId, p.step, p.percent));
      const pulled = await this.pull(userId, undefined, (p) => this.setProgress(userId, p.step, p.percent));
      return { pushed: pushed.pushed || 0, pulled };
    } finally {
      this.clearProgress(userId);
      this.syncingUsers.delete(userId);
    }
  }

  async push(userId: string, onProgress?: (p: { step: string; percent: number }) => void) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    onProgress?.({ step: '获取本地变更', percent: 10 });
    const unsyncedLogs = await logRepo.find({ where: { syncState: SyncState.UNSYNCED }, order: { operatedAt: 'ASC' } });
    if (unsyncedLogs.length === 0) return { pushed: 0 };
    onProgress?.({ step: `同步本地变更: ${unsyncedLogs.length} 条`, percent: 30 });
    try {
      const resp = await axios.post(`${user.mainServerUrl}/api/sync/push`, { logs: unsyncedLogs }, { headers: { Authorization: `Bearer ${user.mainToken}` } });
      const result = resp.data?.data || resp.data;
      for (const r of result.results || []) {
        await logRepo.update(r.logId, { syncState: r.syncState === 'synced' ? SyncState.SYNCED : SyncState.FAILED, syncError: r.syncError || null, syncTime: result.syncTimeStamp });
      }
      const success = (result.results || []).filter((r: any) => r.syncState === 'synced').length;
      const failed = (result.results || []).length - success;
      onProgress?.({ step: `本地同步完成（成功 ${success}，失败 ${failed}）`, percent: 45 });
      return { pushed: unsyncedLogs.length, commitId: result.commitId };
    } catch (err) { this.logger.error(`Push failed: ${err.message}`); throw err; }
  }

  async pull(userId: string, commitId?: string, onProgress?: (p: { step: string; percent: number }) => void) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const lastSynced = await logRepo.findOne({ where: { syncState: SyncState.SYNCED }, order: { syncTime: 'DESC' } });
    const syncTimeStamp = lastSynced?.syncTime || 0;
    let page = 1, totalPulled = 0, totalKnown = 0;
    while (true) {
      try {
        onProgress?.({ step: totalKnown > 0 ? `同步服务端变更 (${totalPulled}/${totalKnown})` : '拉取服务端变更', percent: totalKnown > 0 ? Math.min(50 + Math.round((totalPulled / totalKnown) * 30), 80) : 50 });
        const resp = await axios.post(`${user.mainServerUrl}/api/sync/pull`, { syncTimeStamp, page, pageSize: 1000, commitId }, { headers: { Authorization: `Bearer ${user.mainToken}` } });
        const result = resp.data?.data || resp.data;
        if (totalKnown === 0) totalKnown = result.total || 0;
        for (const log of (result.changes || [])) {
          const exists = await logRepo.findOneBy({ id: log.id });
          if (!exists) {
            const { materializedAt, materializeError, ...cleanLog } = log;
            await logRepo.save(logRepo.create({
              id: cleanLog.id,
              parentType: cleanLog.parentType ?? 'root',
              parentId: cleanLog.parentId ?? 'None',
              operatorId: cleanLog.operatorId,
              operatedAt: Number(cleanLog.operatedAt),
              businessType: cleanLog.businessType,
              operateType: cleanLog.operateType,
              businessId: cleanLog.businessId,
              operateData: cleanLog.operateData,
              syncState: SyncState.SYNCED,
              syncTime: Number(cleanLog.syncTime) > 0 ? Number(cleanLog.syncTime) : Date.now(),
            }));
            totalPulled++;
          }
        }
        if (totalPulled >= result.total || (result.changes || []).length === 0) break;
        page++;
      } catch (err) { this.logger.error(`Pull failed: ${err.message}`); throw err; }
    }
    if (totalPulled > 0) {
      onProgress?.({ step: '应用服务端数据', percent: 90 });
      await this.materialize.flush(userId);
    }
    return totalPulled;
  }

  async getStatus(userId: string) {
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    return { unsynced: await logRepo.countBy({ syncState: SyncState.UNSYNCED }), failed: await logRepo.countBy({ syncState: SyncState.FAILED }) };
  }
}
