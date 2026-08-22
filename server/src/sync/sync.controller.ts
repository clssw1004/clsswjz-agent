import { Controller, Post, Get, Req, Body } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}
  @Post('push') async push(@Req() req) { return this.syncService.push(req.user.userId); }
  @Post('pull') async pull(@Req() req, @Body() body: { commitId?: string }) { return this.syncService.pull(req.user.userId, body.commitId); }
  @Get('status') async status(@Req() req) { return this.syncService.getStatus(req.user.userId); }
}
