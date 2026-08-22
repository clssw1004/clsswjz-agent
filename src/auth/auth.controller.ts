import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { mainServerUrl: string; username: string; password: string }) {
    return this.authService.login(body);
  }

  /** 当前登录用户信息（用于同步设置页展示服务器地址/账号） */
  @Get('me')
  async me(@Req() req) {
    return this.authService.me(req.user.userId);
  }
}
