import { Controller, Get, Post, Query, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DbViewerService } from './db-viewer.service';

/** 数据库只读浏览器（对齐 GUI drift_db_viewer，仅提供只读能力） */
@Controller('db-viewer')
@UseGuards(JwtAuthGuard)
export class DbViewerController {
  constructor(private dbViewerService: DbViewerService) {}

  @Get('tables')
  listTables(@Req() req: any) {
    return this.dbViewerService.listTables(req.user.userId);
  }

  @Get('tables/:name')
  readTable(
    @Req() req: any,
    @Param('name') name: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.dbViewerService.readTable(
      req.user.userId,
      name,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('query')
  query(@Req() req: any, @Body() body: { sql?: string; pageSize?: number }) {
    return this.dbViewerService.query(req.user.userId, body?.sql || '', body?.pageSize || 100);
  }
}
