import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../src/security/jwt-token.service';
import type { AppConfig } from '../src/shared/types';

const secret = 'juman-dev-only-jwt-secret-do-not-use-in-production!!';

function buildServices() {
  const app: Pick<AppConfig, 'auth'> = {
    auth: {
      jwtSecret: secret,
      jwtIssuer: 'juman',
      jwtAudience: 'juman-desktop',
      accessTokenExpireMinutes: 60,
      refreshTokenExpireDays: 7,
      rememberMeRefreshTokenExpireDays: 30,
      argon2: { timeCost: 2, memoryCost: 8192, parallelism: 1 },
      maxFailedLoginAttempts: 5,
      accountLockDurationMinutes: 0,
      passwordMinLength: 10,
      passwordRequireComplexity: true,
      passwordHistoryCount: 5,
    },
  };
  const config = {
    getOrThrow: vi.fn().mockReturnValue(app),
  } as unknown as ConfigService;
  const jwt = new JwtService();
  return new JwtTokenService(jwt, config);
}

describe('JwtTokenService', () => {
  it('creates and validates access tokens with sid binding claims', async () => {
    const service = buildServices();
    const { token, expiresAt } = await service.createAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    expect(token.split('.').length).toBe(3);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.sid).toBe('session-1');
    expect(claims.type).toBe('access');
    expect(claims.iss).toBe('juman');
    expect(claims.aud).toBe('juman-desktop');
  });

  it('rejects invalid tokens', async () => {
    const service = buildServices();
    await expect(service.verifyAccessToken('not.a.jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
