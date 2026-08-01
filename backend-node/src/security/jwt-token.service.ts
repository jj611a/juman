import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JWT_TOKEN_TYPE_ACCESS } from '../core/auth.constants';
import type { AccessTokenClaims, AppConfig } from '../shared/types';

export interface CreateAccessTokenInput {
  readonly userId: string;
  readonly sessionId: string;
}

export interface AccessTokenResult {
  readonly token: string;
  readonly expiresAt: Date;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createAccessToken(input: CreateAccessTokenInput): Promise<AccessTokenResult> {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    const expiresInSeconds = auth.accessTokenExpireMinutes * 60;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    const token = await this.jwt.signAsync(
      {
        sub: input.userId,
        sid: input.sessionId,
        type: JWT_TOKEN_TYPE_ACCESS,
      },
      {
        secret: auth.jwtSecret,
        issuer: auth.jwtIssuer,
        audience: auth.jwtAudience,
        expiresIn: expiresInSeconds,
      },
    );

    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: auth.jwtSecret,
        issuer: auth.jwtIssuer,
        audience: auth.jwtAudience,
      });

      if (payload.type !== JWT_TOKEN_TYPE_ACCESS || !payload.sub || !payload.sid) {
        throw new UnauthorizedException('Invalid access token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
