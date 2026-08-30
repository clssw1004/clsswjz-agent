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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('keyword') keyword?: string,
  ) {
    // 兼容旧调用：按业务查询（ItemForm 等传 businessCode + businessId）
    if (businessCode && businessId) {
      return this.attachmentService.findByBusiness(req.user.userId, businessCode, businessId);
    }
    // 全量分页列表（附件管理页）
    return this.attachmentService.listByBook(req.user.userId, {
      limit: limit ? Math.max(1, Math.min(100, Number(limit))) : 50,
      offset: offset ? Math.max(0, Number(offset)) : 0,
      businessCode,
      keyword,
    });
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
