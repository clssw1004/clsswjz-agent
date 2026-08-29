import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { FuelService } from './fuel.service';

@Controller('fuel-records')
export class FuelController {
  constructor(private fuelService: FuelService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.fuelService.findAll(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.fuelService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.fuelService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.fuelService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.fuelService.remove(req.user.userId, id);
  }
}
