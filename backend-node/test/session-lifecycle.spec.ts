import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../src/auth/services/session.service';
import { RefreshTokenService } from '../src/auth/services/refresh-token.service';
import { OpaqueTokenService } from '../src/security/opaque-token.service';
import type { AppConfig } from '../src/shared/types';
import { UnauthorizedException } from '@nestjs/common';

const authConfig: AppConfig['auth'] = {
  jwtSecret: 'juman-dev-only-jwt-secret-do-not-use-in-production!!',
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
};

describe('session lifecycle', () => {
  it('uses remember-me TTL when creating session expiry', () => {
    const config = {
      getOrThrow: vi.fn().mockReturnValue({ auth: authConfig }),
    } as unknown as ConfigService;
    const prisma = { loginSession: { create: vi.fn() } };
    const sessions = new SessionService(prisma as never, config);

    const now = new Date('2026-08-01T12:00:00.000Z');
    const normal = sessions.resolveExpiry(false, now);
    const remembered = sessions.resolveExpiry(true, now);

    expect(normal.toISOString()).toBe('2026-08-08T12:00:00.000Z');
    expect(remembered.toISOString()).toBe('2026-08-31T12:00:00.000Z');
  });

  it('revokes session family on refresh token reuse', async () => {
    const opaque = new OpaqueTokenService();
    const token = opaque.generate();
    const tokenHash = opaque.hash(token);

    const prisma = {
      refreshToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rt1',
          sessionId: 's1',
          userId: 'u1',
          tokenHash,
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const service = new RefreshTokenService(prisma as never, opaque);
    await expect(service.assertNotReuse(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 's1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('issues hashed opaque refresh tokens', async () => {
    const opaque = new OpaqueTokenService();
    const prisma = {
      refreshToken: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'rt-new', ...data }),
        ),
      },
    };
    const service = new RefreshTokenService(prisma as never, opaque);
    const expiresAt = new Date(Date.now() + 86_400_000);
    const issued = await service.issue({
      userId: 'u1',
      sessionId: 's1',
      expiresAt,
    });

    expect(issued.token.length).toBeGreaterThan(20);
    expect(issued.record.tokenHash).toBe(opaque.hash(issued.token));
    expect(issued.record.tokenHash).not.toBe(issued.token);
  });
});
