import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PasswordHasherService } from '../src/security/password-hasher.service';
import type { AppConfig } from '../src/shared/types';

function mockConfig(): ConfigService {
  const app: Pick<AppConfig, 'auth'> = {
    auth: {
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
    },
  };
  return {
    getOrThrow: vi.fn().mockReturnValue(app),
  } as unknown as ConfigService;
}

describe('PasswordHasherService', () => {
  let hasher: PasswordHasherService;

  beforeEach(() => {
    hasher = new PasswordHasherService(mockConfig());
  });

  it('hashes and verifies with Argon2id', async () => {
    const hash = await hasher.hash('Str0ng!Pass');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verify(hash, 'Str0ng!Pass')).toBe(true);
    expect(await hasher.verify(hash, 'wrong-password')).toBe(false);
  });
});
