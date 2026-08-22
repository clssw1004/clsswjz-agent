import { Controller, Post, Body } from '@nestjs/common';
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
}
