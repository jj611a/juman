import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_MODE_KEY,
} from '../src/core/auth.constants';
import type { AuthPrincipal } from '../src/shared/types';

function principal(permissions: string[]): AuthPrincipal {
  return {
    userId: 'u1',
    username: 'admin',
    fullName: 'Admin',
    roleId: 'r1',
    roleName: 'Admin',
    sessionId: 's1',
    permissions,
    mustChangePassword: false,
    isActive: true,
  };
}

function context(user: AuthPrincipal | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('PermissionsGuard', () => {
  it('allows when all required permissions are present', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return ['users.view', 'users.create'];
        if (key === REQUIRED_PERMISSIONS_MODE_KEY) return 'all';
        return undefined;
      }),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(
      guard.canActivate(context(principal(['users.view', 'users.create', 'roles.view']))),
    ).toBe(true);
  });

  it('denies when a required permission is missing', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return ['users.manage'];
        return undefined;
      }),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context(principal(['users.view'])))).toThrow(
      ForbiddenException,
    );
  });

  it('supports any-mode permission checks', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return ['users.view', 'users.manage'];
        if (key === REQUIRED_PERMISSIONS_MODE_KEY) return 'any';
        return undefined;
      }),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context(principal(['users.view'])))).toBe(true);
  });
});
