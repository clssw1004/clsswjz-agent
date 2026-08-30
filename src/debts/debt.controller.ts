import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { DebtService } from './debt.service';

@Controller('debts')
export class DebtController {
  constructor(private debtService: DebtService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.debtService.listByBook(req.user.userId, {
      limit: query.limit ? Math.max(1, Math.min(100, Number(query.limit))) : 50,
      offset: query.offset ? Math.max(0, Number(query.offset)) : 0,
      clearState: query.clearState,
      keyword: query.keyword,
    });
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.debtService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.debtService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.debtService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.debtService.remove(req.user.userId, id);
  }

  /** 记一笔还款/收款（生成账目，对齐 gui debt_payment_page） */
  @Post(':id/payments')
  addPayment(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.debtService.addPayment(req.user.userId, id, body);
  }
}
