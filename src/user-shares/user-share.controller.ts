import { Controller, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserShareService } from './user-share.service';

@Controller('user-shares')
@UseGuards(JwtAuthGuard)
export class UserShareController {
  constructor(private shareService: UserShareService) {}

  /** 我的共享配置（myShares + sharedToMe） */
  @Get()
  findAll(@Req() req: any) {
    return this.shareService.findAll(req.user.userId);
  }

  /** 可选共享目标：同账本成员（排除自己） */
  @Get('eligible-users')
  listEligibleUsers(@Req() req: any) {
    return this.shareService.listEligibleUsers(req.user.userId);
  }

  /** 设置共享开关（upsert；periodCycle 自动联动 periodDailyRecord） */
  @Put()
  setShare(
    @Req() req: any,
    @Body() body: { targetUserId: string; businessType: string; isEnabled: boolean },
  ) {
    return this.shareService.setShare(req.user.userId, body);
  }

  /** 移除某目标的全部共享 */
  @Delete(':targetUserId')
  removeAllForTarget(@Req() req: any, @Param('targetUserId') targetUserId: string) {
    return this.shareService.removeAllForTarget(req.user.userId, targetUserId);
  }
}
