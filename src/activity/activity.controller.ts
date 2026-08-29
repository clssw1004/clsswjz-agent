import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity-defs')
export class ActivityDefinitionController {
  constructor(private activityService: ActivityService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.activityService.findAllDefinitions(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.activityService.findOneDefinition(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.activityService.createDefinition(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.activityService.updateDefinition(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.activityService.removeDefinition(req.user.userId, id);
  }
}

@Controller('activity-records')
export class ActivityRecordController {
  constructor(private activityService: ActivityService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.activityService.findAllRecords(req.user.userId, query);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.activityService.createRecord(req.user.userId, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.activityService.removeRecord(req.user.userId, id);
  }
}
