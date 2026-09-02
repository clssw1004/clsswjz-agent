import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ItemRelationService } from './item-relation.service';

@Controller('item-relations')
export class ItemRelationController {
  constructor(private svc: ItemRelationService) {}

  @Get()
  findBySource(
    @Req() req,
    @Query('relationCode') relationCode: string,
    @Query('relationId') relationId: string,
  ) {
    return this.svc.findBySource(req.user.userId, relationCode, relationId);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.svc.create(req.user.userId, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.svc.remove(req.user.userId, id);
  }
}
