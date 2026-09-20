import { Injectable, Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { LogSync } from '../entities/log-sync.entity';
import { SyncState } from '../enums/sync-state.enum';
import { BusinessType } from '../enums/business-type.enum';
import { LogRunner } from './log-runner';
import { ConnectionManager } from '../core/connection-manager';

@Injectable()
export class MaterializeService {
  private readonly logger = new Logger(MaterializeService.name);
  private flushPromises = new Map<string, Promise<void>>();

  constructor(private logRunner: LogRunner, private connMgr: ConnectionManager) {}

  async flush(userId: string): Promise<void> {
    if (this.flushPromises.has(userId)) return this.flushPromises.get(userId);
    const p = this.doFlush(userId);
    this.flushPromises.set(userId, p);
    try { await p; } finally { this.flushPromises.delete(userId); }
  }

  private async doFlush(userId: string): Promise<void> {
    const ds = await this.connMgr.getDataSource(userId);
    const logRepo = ds.getRepository(LogSync);
    let processed = 0;
    let failed = 0;
    while (true) {
      const logs = await logRepo.find({
        where: { syncState: SyncState.SYNCED, materializedAt: IsNull() },
        order: { operatedAt: 'ASC' },
        take: 100,
      });
      if (logs.length === 0) break;
      let progressed = 0;
      for (const log of logs) {
        try {
          // ROOT/FUND_BOOK 为伪类型（无对应业务实体），跳过；USER 已有业务实体（app_user），正常回放
          if ([BusinessType.ROOT, BusinessType.FUND_BOOK].includes(log.businessType as any)) {
            await logRepo.update(log.id, { materializedAt: Date.now() });
          } else {
            await this.logRunner.runLogSync(log, ds);
            await logRepo.update(log.id, { materializedAt: Date.now() });
          }
          processed++;
          progressed++;
        } catch (err) {
          // 失败日志不写 materializedAt（保留重试机会），但必须防止下一轮重复取到同一批
          failed++;
          await logRepo.update(log.id, { materializeError: String(err) });
          this.logger.warn(`Materialize failed for log ${log.id}: ${err}`);
        }
      }
      // 本轮零进展 → 剩下这批日志全部回放失败。必须跳出：take=100 会反复取到同一批失败日志，
      // 否则 flush 永不返回，配合 flushPromises 防重入会让该用户的物化彻底停摆（重启前只完成一部分即为此征兆）。
      if (progressed === 0) {
        this.logger.warn(`Materialize stalled for user ${userId}: ${logs.length} logs keep failing, will retry on next flush`);
        break;
      }
      if (logs.length < 100) break;
    }
    if (processed > 0 || failed > 0) {
      this.logger.log(`Materialized ${processed} logs for user ${userId}${failed > 0 ? ` (${failed} failed)` : ''}`);
    }
  }
}
