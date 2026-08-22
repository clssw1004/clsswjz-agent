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

  async push(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const unsyncedLogs = await logRepo.find({ where: { syncState: SyncState.UNSYNCED }, order: { operatedAt: 'ASC' } });
    if (unsyncedLogs.length === 0) return { pushed: 0 };
    try {
      const resp = await axios.post(`${user.mainServerUrl}/api/sync/push`, { logs: unsyncedLogs }, { headers: { Authorization: `Bearer ${user.mainToken}` } });
      const result = resp.data?.data || resp.data;
      for (const r of result.results || []) {
        await logRepo.update(r.logId, { syncState: r.syncState === 'synced' ? SyncState.SYNCED : SyncState.FAILED, syncError: r.syncError || null, syncTime: result.syncTimeStamp });
      }
      return { pushed: unsyncedLogs.length, commitId: result.commitId };
    } catch (err) { this.logger.error(`Push failed: ${err.message}`); throw err; }
  }

  async pull(userId: string, commitId?: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    const lastSynced = await logRepo.findOne({ where: { syncState: SyncState.SYNCED }, order: { syncTime: 'DESC' } });
    const syncTimeStamp = lastSynced?.syncTime || 0;
    let page = 1, totalPulled = 0;
    while (true) {
      try {
        const resp = await axios.post(`${user.mainServerUrl}/api/sync/pull`, { syncTimeStamp, page, pageSize: 1000, commitId }, { headers: { Authorization: `Bearer ${user.mainToken}` } });
        const result = resp.data?.data || resp.data;
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
    if (totalPulled > 0) await this.materialize.flush(userId);
    return { pulled: totalPulled };
  }

  async getStatus(userId: string) {
    const logRepo = await this.connMgr.getRepository(userId, LogSync);
    return { unsynced: await logRepo.countBy({ syncState: SyncState.UNSYNCED }), failed: await logRepo.countBy({ syncState: SyncState.FAILED }) };
  }
}
