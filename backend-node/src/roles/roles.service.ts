import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '../logging/app-logger.service';
import { PermissionsService } from '../permissions/permissions.service';
import { DEFAULT_ROLES } from '../permissions/permission.seeds';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    private readonly repo: RolesRepository,
    private readonly permissions: PermissionsService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // PermissionsModule seeds first via import order + Nest provider init.
    await this.ensureDefaults();
  }

  async ensureDefaults(): Promise<void> {
    await this.permissions.ensureDefaults();

    for (const seed of DEFAULT_ROLES) {
      const role = await this.repo.upsertSystemRole({
        name: seed.name,
        description: seed.description,
      });

      const permissionIds: string[] = [];
      for (const key of seed.permissionKeys) {
        const permission = await this.permissions.getByKey(key);
        if (permission) permissionIds.push(permission.id);
      }
      await this.repo.replacePermissions(role.id, permissionIds);
    }

    this.logger.startup('RBAC system roles ensured', { count: DEFAULT_ROLES.length });
  }

  getById(id: string) {
    return this.repo.findById(id);
  }

  getByName(name: string) {
    return this.repo.findByName(name);
  }

  async listPermissionKeys(roleId: string): Promise<string[]> {
    const role = await this.repo.findById(roleId);
    if (!role || !role.isActive) return [];
    return this.repo.listPermissionKeysForRole(roleId);
  }

  async roleHasPermission(roleId: string, permissionKey: string): Promise<boolean> {
    const keys = await this.listPermissionKeys(roleId);
    return keys.includes(permissionKey);
  }

  async roleHasAnyPermission(roleId: string, permissionKeys: string[]): Promise<boolean> {
    const keys = await this.listPermissionKeys(roleId);
    return permissionKeys.some((k) => keys.includes(k));
  }

  async roleHasAllPermissions(roleId: string, permissionKeys: string[]): Promise<boolean> {
    const keys = await this.listPermissionKeys(roleId);
    return permissionKeys.every((k) => keys.includes(k));
  }

  async listActiveWithPermissions(): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissionKeys: string[];
  }>> {
    const roles = await this.repo.findAllActive();
    const result = [];
    for (const role of roles) {
      const permissionKeys = await this.listPermissionKeys(role.id);
      result.push({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissionKeys,
      });
    }
    return result;
  }
}
