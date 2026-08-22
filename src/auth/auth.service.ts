import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { UserService } from '../meta/user.service';
import { ConnectionManager } from '../core/connection-manager';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private connMgr: ConnectionManager,
    private syncService: SyncService,
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

    // 首次登录立即同步一次（push 本地变更 + pull 主端数据并物化），
    // 让用户进入页面时就能看到数据，而不必等 5 分钟的定时同步。
    // 同步失败不阻塞登录——进入页面后仍可手动触发或等定时同步。
    try {
      await this.syncService.push(user.id);
      await this.syncService.pull(user.id);
    } catch (err) {
      this.logger.warn(`Initial sync after login failed for ${user.id}: ${err.message}`);
    }

    const access_token = this.jwtService.sign({ sub: user.id });

    return {
      access_token,
      userId: user.id,
      nickname: user.nickname,
    };
  }
}
