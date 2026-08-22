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
    while (true) {
      const logs = await logRepo.find({
        where: { syncState: SyncState.SYNCED, materializedAt: IsNull() },
        order: { operatedAt: 'ASC' },
        take: 100,
      });
      if (logs.length === 0) break;
      for (const log of logs) {
        try {
          if ([BusinessType.USER, BusinessType.ROOT, BusinessType.FUND_BOOK].includes(log.businessType as any)) {
            await logRepo.update(log.id, { materializedAt: Date.now() });
          } else {
            await this.logRunner.runLogSync(log, ds);
            await logRepo.update(log.id, { materializedAt: Date.now() });
          }
          processed++;
        } catch (err) {
          await logRepo.update(log.id, { materializeError: String(err) });
          this.logger.warn(`Materialize failed for log ${log.id}: ${err}`);
        }
      }
      if (logs.length < 100) break;
    }
    if (processed > 0) this.logger.log(`Materialized ${processed} logs for user ${userId}`);
  }
}
