import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { BookService } from './book.service';

@Controller('books')
export class BookController {
  constructor(private bookService: BookService) {}

  @Get()
  findAll(@Req() req) {
    return this.bookService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.bookService.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.bookService.create(req.user.userId, body);
  }

  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: any) {
    return this.bookService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.bookService.remove(req.user.userId, id);
  }
}
