import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PeriodService } from './period.service';

@Controller('periods')
@UseGuards(JwtAuthGuard)
export class PeriodController {
  constructor(private periodService: PeriodService) {}

  @Get('cycles')
  listCycles(@Req() req: any, @Query() query: { recent?: string; all?: string; active?: string; year?: string; month?: string }) {
    return this.periodService.listCycles(req.user.userId, {
      recent: query.recent ? Number(query.recent) : undefined,
      all: query.all === 'true',
      active: query.active === 'true',
      year: query.year ? Number(query.year) : undefined,
      month: query.month ? Number(query.month) : undefined,
    });
  }

  @Post('cycles')
  createCycle(@Req() req: any, @Body() body: { startDate: string; endDate?: string; typicalPeriodDays?: number; typicalCycleDays?: number }) {
    return this.periodService.createCycle(req.user.userId, body);
  }

  @Patch('cycles/:id/end')
  updateCycleEnd(@Req() req: any, @Param('id') id: string, @Body() body: { endDate: string }) {
    return this.periodService.updateCycleEnd(req.user.userId, id, body.endDate);
  }

  @Delete('cycles/:id')
  deleteCycle(@Req() req: any, @Param('id') id: string) {
    return this.periodService.deleteCycle(req.user.userId, id);
  }

  @Get('cycles/:cycleId/records')
  listDailyRecords(@Req() req: any, @Param('cycleId') cycleId: string) {
    return this.periodService.listDailyRecords(req.user.userId, cycleId);
  }

  @Put('cycles/:cycleId/records/:date')
  upsertDailyRecord(
    @Req() req: any, @Param('cycleId') cycleId: string, @Param('date') recordDate: string,
    @Body() body: { flowLevel?: string; symptoms?: string; mood?: string; remark?: string },
  ) {
    return this.periodService.upsertDailyRecord(req.user.userId, cycleId, { recordDate, ...body });
  }

  @Delete('cycles/:cycleId/records/:date')
  deleteDailyRecord(@Req() req: any, @Param('cycleId') cycleId: string, @Param('date') recordDate: string) {
    return this.periodService.deleteDailyRecord(req.user.userId, cycleId, recordDate);
  }
}
