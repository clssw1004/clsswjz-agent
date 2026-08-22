import { Controller, Post, Get, Req, Body } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}
  @Post('push') async push(@Req() req) { return this.syncService.push(req.user.userId); }
  @Post('pull') async pull(@Req() req, @Body() body: { commitId?: string }) { return this.syncService.pull(req.user.userId, body.commitId); }
  /** 手动触发完整同步（带进度），立即返回，进度通过 GET /sync/status 轮询 */
  @Post('run')
  async run(@Req() req) {
    const userId = req.user.userId;
    // 不等待完成——前端轮询进度
    this.syncService.syncWithProgress(userId).catch(() => {});
    return { started: true };
  }
  @Get('status')
  async status(@Req() req) {
    const userId = req.user.userId;
    const counts = await this.syncService.getStatus(userId);
    return {
      ...counts,
      ...this.syncService.getProgress(userId),
    };
  }
}
