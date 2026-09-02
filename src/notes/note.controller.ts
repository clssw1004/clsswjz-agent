import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { NoteService } from './note.service';

@Controller('notes')
export class NoteController {
  constructor(private noteService: NoteService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.noteService.findAll(req.user.userId, query);
  }

  /** noteGroup 分组 CRUD：定义在 :id 通配之前，避免 Post(':id') 拦截 */
  @Get('groups')
  findGroups(@Req() req) {
    return this.noteService.findGroups(req.user.userId);
  }

  @Post('groups')
  createGroup(@Req() req, @Body() body: { name: string; accountBookId?: string }) {
    return this.noteService.createGroup(req.user.userId, body);
  }

  @Put('groups/:id')
  updateGroup(@Req() req, @Param('id') id: string, @Body() body: { name: string }) {
    return this.noteService.updateGroup(req.user.userId, id, body);
  }

  @Delete('groups/:id')
  removeGroup(@Req() req, @Param('id') id: string) {
    return this.noteService.removeGroup(req.user.userId, id);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.noteService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.noteService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.noteService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.noteService.remove(req.user.userId, id);
  }
}
