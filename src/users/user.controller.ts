import {
  Controller, Get, Put, Post, Body, Param, Req,
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
}
