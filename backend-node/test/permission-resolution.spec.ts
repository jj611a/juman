import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { RolesService } from '../src/roles/roles.service';
import {
  ALL_PERMISSION_KEYS,
  CASHIER_PERMISSIONS,
} from '../src/permissions/permission.seeds';

describe('permission resolution', () => {
  it('preserves Admin catalog coverage from seeds', () => {
    expect(ALL_PERMISSION_KEYS.length).toBeGreaterThan(50);
    expect(ALL_PERMISSION_KEYS).toContain('users.manage');
    expect(ALL_PERMISSION_KEYS).toContain('rental.settlement.collect');
  });

  it('resolves role permissions via RolesService', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'r1', isActive: true }),
      listPermissionKeysForRole: vi.fn().mockResolvedValue([...CASHIER_PERMISSIONS]),
    };
    const permissions = { ensureDefaults: vi.fn(), getByKey: vi.fn() };
    const logger = { startup: vi.fn() };
    const service = new RolesService(repo as never, permissions as never, logger as never);

    expect(await service.roleHasPermission('r1', 'sale.create')).toBe(true);
    expect(await service.roleHasPermission('r1', 'users.manage')).toBe(false);
    expect(await service.roleHasAnyPermission('r1', ['users.manage', 'sale.view'])).toBe(
      true,
    );
    expect(await service.roleHasAllPermissions('r1', ['sale.view', 'users.manage'])).toBe(
      false,
    );
  });
});
