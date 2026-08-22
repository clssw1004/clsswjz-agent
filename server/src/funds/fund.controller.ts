import { Controller, Get, Query, Req } from '@nestjs/common';
import { FundService } from './fund.service';

@Controller('funds')
export class FundController {
  constructor(private fundService: FundService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.fundService.findAll(req.user.userId, query);
  }
}
