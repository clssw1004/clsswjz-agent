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

    const access_token = this.jwtService.sign({ sub: user.id });

    // 对齐移动端：登录后立即启动两阶段同步（不阻塞登录响应）——
    // 阶段1 拉取 P0+P1 关键数据（user/book/bookMember/fund），前端登录页轮询进度等它完成再进入；
    // 阶段2 延迟 3 秒后台同步剩余全部数据，主界面顶栏状态条展示。
    this.syncService.initialSync(user.id).catch((err) => {
      this.logger.warn(`Initial sync after login failed for ${user.id}: ${err.message}`);
    });

    return {
      access_token,
      userId: user.id,
      nickname: user.nickname,
      initialSyncing: true,
    };
  }
}
