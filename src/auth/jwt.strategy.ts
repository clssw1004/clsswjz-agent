import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectionManager } from '../core/connection-manager';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private connMgr: ConnectionManager,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret'),
    });
  }

  async validate(payload: { sub: string; host?: string }) {
    // 将 host 绑定到 userId（ConnectionManager 以 userId 为键做数据目录隔离）。
    // 不用 AsyncLocalStorage —— 经实测，Nest 的 guard→interceptor→handler 链
    // 无法把 ALS store 可靠地传到 service 层，会导致 host 恒为空串。
    // 旧 token 不带 host 时由 ConnectionManager.resolveHost() 回查 meta.db 兜底。
    if (payload.host) {
      this.connMgr.setHost(payload.sub, payload.host);
    } else {
      // 旧 token 不带 host：回查 meta.db 的 mainServerUrl 反推并预热缓存，
      // 保证后续同步的 getAttachmentsDir() 等调用也能拿到正确目录
      await this.connMgr.resolveHost(payload.sub);
    }
    return { userId: payload.sub };
  }
}
