import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('categories')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  @Get()
  findAll(@Req() req, @Query() query: any) {
    return this.categoryService.findAll(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.categoryService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.categoryService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.categoryService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.categoryService.remove(req.user.userId, id);
  }
}
