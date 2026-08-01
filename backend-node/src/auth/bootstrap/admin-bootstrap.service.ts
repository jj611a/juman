import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_ADMIN_FULL_NAME,
  DEFAULT_ADMIN_USERNAME,
  SYSTEM_ROLE,
} from '../../core/auth.constants';
import { AppLoggerService } from '../../logging/app-logger.service';
import { RolesService } from '../../roles/roles.service';
import { UsersService } from '../../users/users.service';

/**
 * Ensures a default Administrator exists after RBAC seeds.
 * Password from IDENTITY_BOOTSTRAP_PASSWORD or temporary default (must change).
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdministrator();
  }

  async ensureAdministrator(): Promise<void> {
    const username = (
      process.env.IDENTITY_BOOTSTRAP_USERNAME ?? DEFAULT_ADMIN_USERNAME
    )
      .trim()
      .toLowerCase();

    const existing = await this.users.findByUsername(username);
    if (existing) {
      this.logger.startup('Administrator user already present', { username });
      return;
    }

    const adminRole = await this.roles.getByName(SYSTEM_ROLE.ADMIN);
    if (!adminRole) {
      this.logger.error('Admin role missing; cannot bootstrap administrator');
      return;
    }

    const password =
      process.env.IDENTITY_BOOTSTRAP_PASSWORD?.trim() || 'Juman!Bootstrap1';

    await this.users.createUser({
      username,
      password,
      fullName: DEFAULT_ADMIN_FULL_NAME,
      roleId: adminRole.id,
      mustChangePassword: true,
      isActive: true,
    });

    this.logger.startup('Administrator user seeded', {
      username,
      mustChangePassword: true,
    });
  }
}
