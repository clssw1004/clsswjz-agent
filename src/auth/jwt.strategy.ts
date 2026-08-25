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
    // 将 host 写入 AsyncLocalStorage，供 ConnectionManager 后续调用时使用
    if (payload.host) this.connMgr.setHost(payload.host);
    return { userId: payload.sub };
  }
}
