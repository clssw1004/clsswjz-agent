import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { MaterializeService } from './materialize.service';
import { LogRunner } from './log-runner';
import { SyncController } from './sync.controller';

@Module({
  controllers: [SyncController],
  providers: [SyncService, MaterializeService, LogRunner],
  exports: [SyncService],
})
export class SyncModule {}
