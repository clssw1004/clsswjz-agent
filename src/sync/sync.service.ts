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
   * 首次登录两阶段同步（对齐移动端）：
   * 阶段1（阻塞等待）：push + 拉取 P0+P1 关键数据（user/book/bookMember/fund），条目少、速度快
   * 阶段2（延迟后台）：3 秒后拉取剩余全部数据，进度走 backgroundProgress
   *
   * 关键（对齐移动端 sync_service.dart priorityOnly 分支）：
   * 阶段1 是"部分类型拉取"，【不得推进同步游标】——移动端表现为拉完 P0+P1 不更新 lastSyncTime，
   * 后台阶段从【原始游标】拉取全部类型，否则游标被推到 P0 类型日志的最新 syncTime 后，
   * 早于该时间点的 category/symbol/item 等非优先类型日志会永远漏拉。
   */
  async initialSync(userId: string): Promise<void> {
    if (this.syncingUsers.has(userId)) return;
    this.syncingUsers.add(userId);
    let startStamp: number;
    try {
      // 记录初始游标：本次两阶段拉取都基于它（阶段1 限类型、阶段2 全量），避免部分拉取推进游标导致漏数据
      startStamp = await this.getLastSyncStamp(userId);
      // 阶段 1：优先数据
      this.setProgress(userId, '检查服务端状态', 5);
      const pushResult = await this.push(userId, (p) => this.setProgress(userId, p.step, Math.round(p.percent * 0.5)));
      const PRIORITY_TYPES = ['user', 'book', 'bookMember', 'fund'];
      await this.pull(userId, pushResult.commitId, (p) => this.setProgress(userId, p.step, Math.round(50 + p.percent * 0.5)), PRIORITY_TYPES, startStamp);
      this.syncProgress.set(userId, { syncing: true, step: '关键数据同步完成', percent: 100 });
    } finally {
      this.clearProgress(userId);
      this.syncingUsers.delete(userId);
    }

    // 阶段 2：延迟 3 秒后台同步剩余全部数据（对齐移动端 _startBackgroundSync）
    // 必须从 startStamp（原始游标）全量拉取，否则非优先类型（category/symbol/item…）早期日志被游标漏掉
    setTimeout(async () => {
      try {
        await this.syncWithProgress(userId, { syncTimeStamp: startStamp });
      } catch (err) {
        this.logger.warn(`Background full sync failed for ${userId}: ${err.message}`);
      }
    }, 3000);
  }

  /** 读取当前同步游标：本地 log_sync 中最新一条 SYNCED 日志的 syncTime（无则 0） */
  private async getLastSyncStamp(userId: string): Promise<number> {
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const lastSynced = await logRepo.findOne({ where: { syncState: SyncState.SYNCED }, order: { syncTime: 'DESC' } });
    return lastSynced?.syncTime || 0;
  }

  /**
   * 完整同步一轮（push → pull → 物化），带进度上报。
   * 返回 { pushed, pulled }。
   * [opts.syncTimeStamp] 显式指定拉取游标；不传时使用本地最新游标（等价于增量全量同步）。
   */
  async syncWithProgress(userId: string, opts?: { syncTimeStamp?: number }): Promise<{ pushed: number; pulled: number }> {
    if (this.syncingUsers.has(userId)) return { pushed: 0, pulled: 0 };
    this.syncingUsers.add(userId);
    try {
      this.setProgress(userId, '检查服务端状态', 5);
      const pushed = await this.push(userId, (p) => this.setProgress(userId, p.step, p.percent));
      const pulled = await this.pull(userId, undefined, (p) => this.setProgress(userId, p.step, p.percent), undefined, opts?.syncTimeStamp);
      return { pushed: pushed.pushed || 0, pulled };
    } finally {
      this.clearProgress(userId);
      this.syncingUsers.delete(userId);
    }
  }

  /**
   * 主端鉴权失效标记（per-user）：主服务器返回 401（token 过期/无效）时置位，
   * 由 GET /sync/status 透传给前端，前端据此跳转登录页（登录页自动回填主端地址）。
   */
  private readonly mainAuthExpired = new Map<string, boolean>();

  markMainAuthExpired(userId: string) { this.mainAuthExpired.set(userId, true); }

  clearAuthExpired(userId: string) { this.mainAuthExpired.delete(userId); }

  isMainAuthExpired(userId: string): boolean { return this.mainAuthExpired.get(userId) || false; }

  /** 主端请求错误统一处理：401 时标记鉴权失效，其余透传 */
  private handleMainError(userId: string, err: any): void {
    if (err?.response?.status === 401) {
      this.logger.warn(`Main server 401 for user ${userId}: ${err.response?.data?.message || 'unauthorized'}`);
      this.markMainAuthExpired(userId);
    } else {
      this.logger.error(`Main server error for user ${userId}: ${err?.response?.status || err?.code} ${err?.message || ''}`);
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
    } catch (err) {
      this.handleMainError(userId, err);
      this.logger.error(`Push failed: ${err.message}`);
      throw err;
    }
  }

  async pull(
    userId: string,
    commitId?: string,
    onProgress?: (p: { step: string; percent: number }) => void,
    businessTypes?: string[],
    syncTimeStampOverride?: number,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const tokenPreview = user.mainToken ? user.mainToken.substring(0, 10) + '...' : '(empty)';
    this.logger.debug(`Pull for ${userId}: server=${user.mainServerUrl}, token=${tokenPreview}`);
    // 游标优先级：显式指定 > 本地最新游标。显式游标用于两阶段同步（阶段1限类型/阶段2全量共用同一游标），
    // 防止"部分类型拉取把游标推到 P0 日志最新 syncTime、导致非优先类型早期日志永久漏拉"（对齐移动端不推进 lastSyncTime）。
    const syncTimeStamp = syncTimeStampOverride !== undefined
      ? syncTimeStampOverride
      : await this.getLastSyncStamp(userId);
    let page = 1, totalPulled = 0, totalKnown = 0;
    while (true) {
      try {
        onProgress?.({ step: totalKnown > 0 ? `同步服务端变更 (${totalPulled}/${totalKnown})` : '拉取服务端变更', percent: totalKnown > 0 ? Math.min(50 + Math.round((totalPulled / totalKnown) * 30), 80) : 50 });
        const resp = await axios.post(`${user.mainServerUrl}/api/sync/pull`, { syncTimeStamp, page, pageSize: 1000, commitId, businessTypes }, { headers: { Authorization: `Bearer ${user.mainToken}` } });
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
      } catch (err) {
        this.handleMainError(userId, err);
        this.logger.error(`Pull failed: ${err.message}`);
        throw err;
      }
    }
    if (totalPulled > 0) {
      onProgress?.({ step: '应用服务端数据', percent: 90 });
      await this.materialize.flush(userId);
    }
    return totalPulled;
  }

  async getStatus(userId: string) {
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    return {
      unsynced: await logRepo.countBy({ syncState: SyncState.UNSYNCED }),
      failed: await logRepo.countBy({ syncState: SyncState.FAILED }),
      mainAuthExpired: this.isMainAuthExpired(userId),
    };
  }

  /**
   * 全量重拉（修复存量数据）：先把本地未同步日志 push 到服务端，再清空本地 log_sync（重置游标），
   * 最后从 0 全量拉取全部类型日志并物化。用于修复历史版本"部分类型拉取推进游标"
   * 导致的 category/symbol（项目/标签）等数据缺失。
   * 幂等安全：服务端日志按 id 去重，业务表重放历史日志后状态与服务端一致。
   * [clearData=true] 时重置整个用户数据目录（断开连接→删除 data/<userId>→重建），
   * 对齐移动端"重置凭证&数据重置同步"：切换账号后旧账号数据不残留，从新服务器全量重建。
   */
  async fullResync(userId: string, clearData = false): Promise<{ pushed: number; pulled: number }> {
    if (this.syncingUsers.has(userId)) return { pushed: 0, pulled: 0 };
    this.syncingUsers.add(userId);
    try {
      this.setProgress(userId, '推送本地变更', 10);
      const pushed = await this.push(userId, (p) => this.setProgress(userId, p.step, p.percent));
      // 重置游标：清空本地日志（本地未同步的已在上一步推送）
      if (clearData) {
        this.setProgress(userId, '清空本地数据', 20);
        await this.connMgr.resetUserDataDir(userId);
        this.logger.log(`Full resync: reset user data dir for ${userId}`);
      } else {
        const logRepo = await this.connMgr.getRepository(userId, LogSync);
        await logRepo.clear();
        this.logger.log(`Full resync: cleared logs for user ${userId}`);
      }
      const pulled = await this.pull(userId, undefined, (p) => this.setProgress(userId, p.step, p.percent), undefined, 0);
      return { pushed: pushed.pushed || 0, pulled };
    } finally {
      this.clearProgress(userId);
      this.syncingUsers.delete(userId);
    }
  }
}
