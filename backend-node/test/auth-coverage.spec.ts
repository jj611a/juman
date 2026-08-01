import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../src/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PasswordChangeGuard } from '../src/auth/guards/password-change.guard';
import { AuthService } from '../src/auth/services/auth.service';
import { OpaqueTokenService } from '../src/security/opaque-token.service';
import { IS_PUBLIC_KEY } from '../src/core/auth.constants';

describe('Auth coverage extras', () => {
  it('OpaqueTokenService hash and timing-safe match', () => {
    const opaque = new OpaqueTokenService();
    const token = opaque.generate(32);
    const hash = opaque.hash(token);
    expect(opaque.matches(token, hash)).toBe(true);
    expect(opaque.matches('other', hash)).toBe(false);
  });

  it('JwtAuthGuard allows public routes', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => (key === IS_PUBLIC_KEY ? true : undefined)),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate({ getHandler: () => ({}), getClass: () => ({}) } as ExecutionContext)).toBe(true);
  });

  it('PasswordChangeGuard skips public and missing user', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const auth = { assertPasswordChangeAllowed: vi.fn() };
    const guard = new PasswordChangeGuard(reflector, auth as never);
    expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as ExecutionContext),
    ).toBe(true);
  });

  it('RequirePermissions metadata helpers exist', () => {
    expect(typeof RequirePermissions('users.view')).toBe('function');
    expect(typeof RequireAnyPermission('users.view', 'users.manage')).toBe('function');
  });

  it('AuthService.getMe and getSession', async () => {
    const sessions = {
      getActive: vi.fn().mockResolvedValue({
        id: 's1',
        rememberMe: false,
        expiresAt: new Date(Date.now() + 10000),
        lastActivityAt: new Date(),
        deviceName: 'desk',
      }),
    };
    const service = new AuthService(
      {} as never,
      {} as never,
      sessions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { getOrThrow: vi.fn() } as never,
    );
    const principal = {
      userId: 'u1',
      username: 'admin',
      fullName: 'Admin',
      roleId: 'r1',
      roleName: 'Admin',
      sessionId: 's1',
      permissions: ['users.view'],
      mustChangePassword: false,
      isActive: true,
    };
    const me = await service.getMe(principal);
    expect(me.username).toBe('admin');
    const session = await service.getSession(principal);
    expect(session.deviceName).toBe('desk');
  });

  it('AuthService.restoreSession requires credentials', async () => {
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { getOrThrow: vi.fn() } as never,
    );
    await expect(service.restoreSession({})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('CurrentUser decorator factory is defined', () => {
    expect(CurrentUser).toBeTruthy();
  });
});
