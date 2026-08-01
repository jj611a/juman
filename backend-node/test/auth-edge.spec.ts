import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/services/auth.service';

describe('AuthService edge paths', () => {
  function build() {
    const users = {
      normalizeUsername: (u: string) => u.toLowerCase(),
      findById: vi.fn(),
      clearLockIfExpired: vi.fn(async (u: unknown) => u),
      isCurrentlyLocked: vi.fn().mockReturnValue(false),
      verifyPassword: vi.fn(),
      listPasswordHistory: vi.fn().mockResolvedValue([]),
      changePassword: vi.fn(),
    };
    const sessions = { getActive: vi.fn(), touch: vi.fn(), revokeAllForUser: vi.fn() };
    const refreshTokens = {
      assertNotReuse: vi.fn().mockResolvedValue({ id: 'rt', userId: 'u1', sessionId: 's1' }),
      rotate: vi.fn(),
      revokeSessionFamily: vi.fn(),
      revokeAllForUser: vi.fn(),
      revokeSessionFamilyExcept: vi.fn(),
    };
    const policy = { validate: vi.fn().mockReturnValue({ valid: false, errors: ['too weak'] }) };
    const hasher = { hash: vi.fn(), verify: vi.fn().mockResolvedValue(false) };
    const service = new AuthService(
      users as never,
      { listPermissionKeys: vi.fn().mockResolvedValue([]) } as never,
      sessions as never,
      refreshTokens as never,
      { recordPasswordChanged: vi.fn() } as never,
      { createAccessToken: vi.fn().mockResolvedValue({ token: 'a', expiresAt: new Date() }) } as never,
      hasher as never,
      policy as never,
      { getOrThrow: vi.fn().mockReturnValue({ auth: { passwordHistoryCount: 1 } }) } as never,
    );
    return { service, users, sessions, refreshTokens, policy };
  }

  it('refresh rejects inactive user', async () => {
    const { service, users, sessions, refreshTokens } = build();
    sessions.getActive.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) });
    users.findById.mockResolvedValue({ id: 'u1', isActive: false });
    await expect(service.refresh('t')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh rejects locked user', async () => {
    const { service, users, sessions } = build();
    sessions.getActive.mockResolvedValue({ id: 's1', expiresAt: new Date(Date.now() + 1000) });
    users.findById.mockResolvedValue({
      id: 'u1', isActive: true, isLocked: true,
      role: { isActive: true, deletedAt: null, name: 'Admin' },
    });
    users.isCurrentlyLocked.mockReturnValue(true);
    await expect(service.refresh('t')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changePassword rejects policy failures', async () => {
    const { service, users, policy } = build();
    users.findById.mockResolvedValue({ id: 'u1', username: 'admin', passwordHash: 'h' });
    users.verifyPassword.mockResolvedValue(true);
    await expect(
      service.changePassword(
        { userId: 'u1', username: 'admin', fullName: 'A', roleId: 'r', roleName: 'Admin', sessionId: 's', permissions: [], mustChangePassword: true, isActive: true },
        'cur',
        'weak',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(policy.validate).toHaveBeenCalled();
  });
});
