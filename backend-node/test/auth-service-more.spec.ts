import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/services/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

function build() {
  const users = {
    normalizeUsername: (u: string) => u.trim().toLowerCase(),
    findByUsername: vi.fn(),
    findById: vi.fn(),
    clearLockIfExpired: vi.fn(async (u: unknown) => u),
    isCurrentlyLocked: vi.fn().mockReturnValue(false),
    verifyPassword: vi.fn(),
    recordFailedLogin: vi.fn().mockResolvedValue({ lockedNow: false }),
    recordSuccessfulLogin: vi.fn(),
    listPasswordHistory: vi.fn().mockResolvedValue([{ passwordHash: 'hist' }]),
    changePassword: vi.fn(),
  };
  const roles = { listPermissionKeys: vi.fn().mockResolvedValue(['users.view']) };
  const sessions = {
    create: vi.fn(),
    getActive: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    touch: vi.fn(),
  };
  const refreshTokens = {
    issue: vi.fn(),
    assertNotReuse: vi.fn(),
    rotate: vi.fn(),
    revokeSessionFamily: vi.fn(),
    revokeAllForUser: vi.fn(),
    revokeSessionFamilyExcept: vi.fn(),
  };
  const history = {
    recordLogin: vi.fn(),
    recordLoginFailed: vi.fn(),
    recordLogout: vi.fn(),
    recordAccountLocked: vi.fn(),
    recordPasswordChanged: vi.fn(),
  };
  const jwt = {
    createAccessToken: vi.fn().mockResolvedValue({ token: 'a', expiresAt: new Date() }),
    verifyAccessToken: vi.fn(),
  };
  const hasher = { hash: vi.fn().mockResolvedValue('nh'), verify: vi.fn(), verifyDummy: vi.fn().mockResolvedValue(undefined) };
  const policy = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };
  const config = { getOrThrow: vi.fn().mockReturnValue({ auth: { passwordHistoryCount: 5 } }) };
  const service = new AuthService(
    users as never, roles as never, sessions as never, refreshTokens as never,
    history as never, jwt as never, hasher as never, policy as never, config as never,
  );
  return { service, users, roles, sessions, refreshTokens, history, jwt, hasher, policy };
}

describe('AuthService deeper branches', () => {
  it('refresh rotates when session and user are valid', async () => {
    const { service, users, sessions, refreshTokens } = build();
    refreshTokens.assertNotReuse.mockResolvedValue({
      id: 'rt1', userId: 'u1', sessionId: 's1', revokedAt: null,
      expiresAt: new Date(Date.now() + 99999),
    });
    sessions.getActive.mockResolvedValue({
      id: 's1', expiresAt: new Date(Date.now() + 99999), rememberMe: true,
    });
    users.findById.mockResolvedValue({
      id: 'u1', username: 'admin', isActive: true, isLocked: false,
      role: { name: 'Admin', isActive: true, deletedAt: null }, roleId: 'r1',
      mustChangePassword: false, fullName: 'Admin',
    });
    refreshTokens.rotate.mockResolvedValue({ token: 'new-refresh', record: { id: 'rt2' } });
    const result = await service.refresh('old');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.rememberMe).toBe(true);
  });

  it('refresh rejects expired session', async () => {
    const { service, sessions, refreshTokens } = build();
    refreshTokens.assertNotReuse.mockResolvedValue({
      id: 'rt1', userId: 'u1', sessionId: 's1',
    });
    sessions.getActive.mockResolvedValue(null);
    await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokens.revokeSessionFamily).toHaveBeenCalledWith('s1');
  });

  it('changePassword rejects reused history password', async () => {
    const { service, users, hasher } = build();
    users.findById.mockResolvedValue({ id: 'u1', username: 'admin', passwordHash: 'old' });
    users.verifyPassword.mockResolvedValue(true);
    hasher.verify.mockResolvedValue(true);
    await expect(
      service.changePassword(
        { userId: 'u1', username: 'admin', fullName: 'A', roleId: 'r1', roleName: 'Admin', sessionId: 's1', permissions: [], mustChangePassword: true, isActive: true },
        'old',
        'Reuse!Pass1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolvePrincipalFromClaims validates type/session/user/lock', async () => {
    const { service, sessions, users } = build();
    await expect(
      service.resolvePrincipalFromClaims({ sub: 'u1', sid: 's1', type: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    sessions.getActive.mockResolvedValue(null);
    await expect(
      service.resolvePrincipalFromClaims({ sub: 'u1', sid: 's1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    sessions.getActive.mockResolvedValue({ id: 's1' });
    users.findById.mockResolvedValue(null);
    await expect(
      service.resolvePrincipalFromClaims({ sub: 'u1', sid: 's1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    users.findById.mockResolvedValue({
      id: 'u1', username: 'admin', isActive: true, isLocked: true,
      role: { name: 'Admin', isActive: true, deletedAt: null }, roleId: 'r1',
      mustChangePassword: false, fullName: 'Admin',
    });
    users.isCurrentlyLocked.mockReturnValue(true);
    await expect(
      service.resolvePrincipalFromClaims({ sub: 'u1', sid: 's1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('restoreSession with access token returns session view', async () => {
    const { service, sessions, users, jwt } = build();
    jwt.verifyAccessToken.mockResolvedValue({ sub: 'u1', sid: 's1', type: 'access' });
    sessions.getActive.mockResolvedValue({
      id: 's1', rememberMe: false, expiresAt: new Date(Date.now() + 1000),
      lastActivityAt: new Date(), deviceName: 'd',
    });
    users.findById.mockResolvedValue({
      id: 'u1', username: 'admin', isActive: true, isLocked: false,
      role: { name: 'Admin', isActive: true, deletedAt: null }, roleId: 'r1',
      mustChangePassword: false, fullName: 'Admin',
    });
    const view = await service.restoreSession({ accessToken: 'tok' });
    expect(view.session.sessionId).toBe('s1');
    expect(view.tokens).toBeUndefined();
  });

  it('JwtStrategy rejects invalid token type', async () => {
    const auth = { resolvePrincipalFromClaims: vi.fn() };
    const config = {
      getOrThrow: vi.fn().mockReturnValue({
        auth: {
          jwtSecret: 'juman-dev-only-jwt-secret-do-not-use-in-production!!',
          jwtIssuer: 'juman',
          jwtAudience: 'juman-desktop',
        },
      }),
    };
    const strategy = new JwtStrategy(config as never, auth as never);
    await expect(
      strategy.validate({ sub: 'u1', sid: 's1', type: 'refresh' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
