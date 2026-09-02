import {
  Controller, Get, Put, Post, Body, Param, Query, Req,
  UploadedFile, UseInterceptors, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';
import { AttachmentService } from '../attachments/attachment.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private userService: UserService,
    private attachmentService: AttachmentService,
  ) {}

  /** 当前用户资料（对齐 gui getUserInfo） */
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.userId);
  }

  /** 批量解析昵称（统计卡/共享列表按 id 翻译展示名）；ids 逗号分隔 */
  @Get('nicknames')
  getNicknames(@Req() req: any, @Query('ids') ids: string) {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.userService.getNicknames(req.user.userId, list);
  }

  /** 更新个人资料（昵称/邮箱/手机号），写 USER UPDATE 日志 */
  @Put('profile')
  updateProfile(
    @Req() req: any,
    @Body() body: { nickname?: string; email?: string; phone?: string; timezone?: string; language?: string },
  ) {
    return this.userService.updateProfile(req.user.userId, body);
  }

  /** 更新头像：multipart 上传 → 附件落盘 + avatar 字段更新 + USER 日志 */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const saved = await this.attachmentService.upload(req.user.userId, file, 'user', req.user.userId);
    return this.userService.updateAvatar(req.user.userId, (saved as any).id);
  }

  /** 读取用户偏好（agent-local，不参与同步） */
  @Get('preferences')
  getPreferences(@Req() req: any) {
    return this.userService.getPreferences(req.user.userId);
  }

  /** 合并更新用户偏好；传 null 表示清除该键 */
  @Put('preferences')
  updatePreferences(@Req() req: any, @Body() body: Record<string, any>) {
    return this.userService.updatePreferences(req.user.userId, body || {});
  }
}
