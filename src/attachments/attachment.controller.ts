import {
  Controller, Get, Post, Delete, Param, Query, Req, Res,
  UploadedFile, UseInterceptors, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { AttachmentService } from './attachment.service';

@Controller('attachments')
export class AttachmentController {
  constructor(private attachmentService: AttachmentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('businessCode') businessCode: string,
    @Body('businessId') businessId: string,
  ) {
    return this.attachmentService.upload(req.user.userId, file, businessCode, businessId);
  }

  @Get()
  async list(
    @Req() req,
    @Query('businessCode') businessCode: string,
    @Query('businessId') businessId: string,
  ) {
    return this.attachmentService.findByBusiness(req.user.userId, businessCode, businessId);
  }

  @Get(':id')
  async download(@Req() req, @Param('id') id: string, @Res() res: Response) {
    // 懒加载：本地缺失时从主端按需下载并缓存（对齐 gui downloadAttachment）
    const { filePath, attachment } = await this.attachmentService.getOrDownloadFile(req.user.userId, id);
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.originName)}`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: string) {
    return this.attachmentService.remove(req.user.userId, id);
  }
}
