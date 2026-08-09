import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RolesService } from './roles.service';
import { ROLE_PERMISSION } from './roles.constants';

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions(ROLE_PERMISSION.VIEW)
  async list() {
    return this.roles.listActiveWithPermissions();
  }
}