import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { VehicleService } from './vehicle.service';

@Controller('vehicles')
export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  @Get()
  findAll(@Req() req) {
    return this.vehicleService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.vehicleService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.vehicleService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.vehicleService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.vehicleService.remove(req.user.userId, id);
  }
}
