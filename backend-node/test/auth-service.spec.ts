import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/services/auth.service';
import { AUDIT_EVENT } from '../src/core/auth.constants';

function buildService(overrides: Record<string, unknown> = {}) {
  const users = {
    normalizeUsername: (u: string) => u.trim().toLowerCase(),
    findByUsername: vi.fn(),
    findById: vi.fn(),
    clearLockIfExpired: vi.fn(async (u: unknown) => u),
    isCurrentlyLocked: vi.fn().mockReturnValue(false),
    verifyPassword: vi.fn(),
    recordFailedLogin: vi.fn().mockResolvedValue({ lockedNow: false }),
    recordSuccessfulLogin: vi.fn(),
    listPasswordHistory: vi.fn().mockResolvedValue([]),
    changePassword: vi.fn(),
    disableAccount: vi.fn(),
    enableAccount: vi.fn(),
    setActive: vi.fn(),
  };
  const roles = { listPermissionKeys: vi.fn().mockResolvedValue(['users.view']) };
  const sessions = {
    create: vi.fn().mockResolvedValue({
      id: 's1',
      expiresAt: new Date(Date.now() + 86400000),
      rememberMe: false,
      lastActivityAt: new Date(),
      deviceName: null,
    }),
    getActive: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    touch: vi.fn(),
  };
  const refreshTokens = {
    issue: vi.fn().mockResolvedValue({ token: 'refresh-raw', record: { id: 'rt1' } }),
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
    createAccessToken: vi.fn().mockResolvedValue({
      token: 'access.jwt',
      expiresAt: new Date(Date.now() + 3600000),
    }),
    verifyAccessToken: vi.fn(),
  };
  const hasher = { hash: vi.fn().mockResolvedValue('new-hash'), verify: vi.fn().mockResolvedValue(false) };
  const policy = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };
  const config = {
    getOrThrow: vi.fn().mockReturnValue({
      auth: { passwordHistoryCount: 5 },
    }),
  };

  Object.assign(users, overrides.users ?? {});
  Object.assign(sessions, overrides.sessions ?? {});
  Object.assign(history, overrides.history ?? {});
  Object.assign(hasher, overrides.hasher ?? {});
  Object.assign(policy, overrides.policy ?? {});

  const service = new AuthService(
    users as never,
    roles as never,
    sessions as never,
    refreshTokens as never,
    history as never,
    jwt as never,
    hasher as never,
    policy as never,
    config as never,
  );

  return { service, users, roles, sessions, refreshTokens, history, jwt, hasher, policy };
}

describe('AuthService unit', () => {
  it('rejects bad password and records LOGIN_FAILED', async () => {
    const { service, users, history } = buildService();
    users.findByUsername.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      deletedAt: null,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      passwordHash: 'hash',
      role: { name: 'Admin', isActive: true, deletedAt: null },
      roleId: 'r1',
      mustChangePassword: false,
      fullName: 'Admin',
    });
    users.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ username: 'admin', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(history.recordLoginFailed).toHaveBeenCalled();
  });

  it('records ACCOUNT_LOCKED when threshold reached', async () => {
    const { service, users, history } = buildService();
    users.findByUsername.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      deletedAt: null,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 4,
      passwordHash: 'hash',
      role: { name: 'Admin', isActive: true, deletedAt: null },
      roleId: 'r1',
      mustChangePassword: false,
      fullName: 'Admin',
    });
    users.verifyPassword.mockResolvedValue(false);
    users.recordFailedLogin.mockResolvedValue({ lockedNow: true });

    await expect(
      service.login({ username: 'admin', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(history.recordAccountLocked).toHaveBeenCalled();
  });

  it('logs in and records LOGIN audit event', async () => {
    const { service, users, history } = buildService();
    users.findByUsername.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      deletedAt: null,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      passwordHash: 'hash',
      role: { name: 'Admin', isActive: true, deletedAt: null },
      roleId: 'r1',
      mustChangePassword: true,
      fullName: 'Administrator',
    });
    users.verifyPassword.mockResolvedValue(true);

    const result = await service.login({
      username: 'Admin',
      password: 'ok',
      rememberMe: true,
    });
    expect(result.accessToken).toBe('access.jwt');
    expect(result.rememberMe).toBe(true);
    expect(history.recordLogin).toHaveBeenCalled();
  });

  it('changePassword rejects incorrect current password', async () => {
    const { service, users } = buildService();
    users.findById.mockResolvedValue({
      id: 'u1',
      username: 'admin',
      passwordHash: 'hash',
    });
    users.verifyPassword.mockResolvedValue(false);

    await expect(
      service.changePassword(
        {
          userId: 'u1',
          username: 'admin',
          fullName: 'A',
          roleId: 'r1',
          roleName: 'Admin',
          sessionId: 's1',
          permissions: [],
          mustChangePassword: true,
          isActive: true,
        },
        'wrong',
        'NewStrong!Pass1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assertPasswordChangeAllowed blocks non-allowlisted paths', () => {
    const { service } = buildService();
    expect(() =>
      service.assertPasswordChangeAllowed(
        {
          userId: 'u1',
          username: 'admin',
          fullName: 'A',
          roleId: 'r1',
          roleName: 'Admin',
          sessionId: 's1',
          permissions: [],
          mustChangePassword: true,
          isActive: true,
        },
        '/customers',
      ),
    ).toThrow(ForbiddenException);
  });

  it('exports audit event constants used by history', () => {
    expect(AUDIT_EVENT.LOGIN).toBe('LOGIN');
    expect(AUDIT_EVENT.LOGIN_FAILED).toBe('LOGIN_FAILED');
    expect(AUDIT_EVENT.PASSWORD_CHANGED).toBe('PASSWORD_CHANGED');
    expect(AUDIT_EVENT.ACCOUNT_LOCKED).toBe('ACCOUNT_LOCKED');
    expect(AUDIT_EVENT.LOGOUT).toBe('LOGOUT');
  });
  it('changePassword succeeds and keeps current session', async () => {
    const { service, users, sessions, refreshTokens, history, hasher, policy } = buildService();
    users.findById.mockResolvedValue({ id: 'u1', username: 'admin', passwordHash: 'old-hash' });
    users.verifyPassword.mockResolvedValue(true);
    policy.validate.mockReturnValue({ valid: true, errors: [] });
    hasher.verify.mockResolvedValue(false);
    hasher.hash.mockResolvedValue('new-hash');
    await service.changePassword(
      { userId: 'u1', username: 'admin', fullName: 'A', roleId: 'r1', roleName: 'Admin', sessionId: 's1', permissions: [], mustChangePassword: true, isActive: true },
      'old',
      'NewStrong!Pass1',
    );
    expect(users.changePassword).toHaveBeenCalled();
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1', 'u1', 's1');
    expect(refreshTokens.revokeSessionFamilyExcept).toHaveBeenCalledWith('u1', 's1');
    expect(history.recordPasswordChanged).toHaveBeenCalled();
  });

  it('logout revokes session and records LOGOUT', async () => {
    const { service, sessions, refreshTokens, history } = buildService();
    await service.logout({
      userId: 'u1', username: 'admin', fullName: 'A', roleId: 'r1', roleName: 'Admin',
      sessionId: 's1', permissions: [], mustChangePassword: false, isActive: true,
    });
    expect(sessions.revoke).toHaveBeenCalledWith('s1', 'u1');
    expect(refreshTokens.revokeSessionFamily).toHaveBeenCalledWith('s1');
    expect(history.recordLogout).toHaveBeenCalled();
  });

  it('rejects inactive user on login', async () => {
    const { service, users, history } = buildService();
    users.findByUsername.mockResolvedValue({
      id: 'u1', username: 'admin', deletedAt: null, isActive: false, isLocked: false,
      failedLoginAttempts: 0, passwordHash: 'hash',
      role: { name: 'Admin', isActive: true, deletedAt: null }, roleId: 'r1',
      mustChangePassword: false, fullName: 'Admin',
    });
    await expect(service.login({ username: 'admin', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(history.recordLoginFailed).toHaveBeenCalled();
  });

});
