import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_TOKEN_TYPE_ACCESS } from '../../core/auth.constants';
import type { AccessTokenClaims, AppConfig, AuthPrincipal } from '../../shared/types';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const authConfig = config.getOrThrow<AppConfig>('app').auth;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
      issuer: authConfig.jwtIssuer,
      audience: authConfig.jwtAudience,
    });
  }

  async validate(payload: AccessTokenClaims): Promise<AuthPrincipal> {
    if (payload.type !== JWT_TOKEN_TYPE_ACCESS || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
    }
    return this.auth.resolvePrincipalFromClaims(payload);
  }
}
