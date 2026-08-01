import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '../logging/app-logger.service';
import { DEFAULT_PERMISSIONS } from './permission.seeds';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(
    private readonly repo: PermissionsRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  async ensureDefaults(): Promise<number> {
    let createdOrUpdated = 0;
    for (const seed of DEFAULT_PERMISSIONS) {
      await this.repo.upsertByKey(seed);
      createdOrUpdated += 1;
    }
    this.logger.startup('RBAC permissions ensured', { count: createdOrUpdated });
    return createdOrUpdated;
  }

  listActive() {
    return this.repo.findAllActive();
  }

  getByKey(key: string) {
    return this.repo.findByKey(key);
  }
}
