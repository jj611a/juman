import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsService } from './permissions.service';
import { PERMISSION_PERMISSION } from './permissions.constants';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermissions(PERMISSION_PERMISSION.VIEW)
  async list() {
    const perms = await this.permissions.listActive();
    return perms.map((p) => ({
      key: p.key,
      displayName: p.displayName,
      description: p.description,
      module: p.module,
    }));
  }
}