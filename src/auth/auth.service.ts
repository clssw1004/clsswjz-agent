import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { UserService } from '../meta/user.service';
import { ConnectionManager } from '../core/connection-manager';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private connMgr: ConnectionManager,
  ) {}

  async login(body: {
    mainServerUrl: string;
    username: string;
    password: string;
  }) {
    const { mainServerUrl, username, password } = body;

    let mainResponse: any;
    try {
      const resp = await axios.post(`${mainServerUrl}/api/auth/login`, {
        username,
        password,
      });
      mainResponse = resp.data?.data || resp.data;
    } catch (err) {
      throw new UnauthorizedException(
        '主端认证失败: ' + (err.response?.data?.message || err.message),
      );
    }

    if (!mainResponse?.access_token) {
      throw new UnauthorizedException('主端未返回 token');
    }

    const user = await this.userService.upsertUser({
      id: mainResponse.userId,
      nickname: mainResponse.nickname || mainResponse.username,
      mainServerUrl,
      mainToken: mainResponse.access_token,
    });

    await this.connMgr.initUserDataDir(user.id);

    const access_token = this.jwtService.sign({ sub: user.id });

    return {
      access_token,
      userId: user.id,
      nickname: user.nickname,
    };
  }
}
