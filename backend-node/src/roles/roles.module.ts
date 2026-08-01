import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

@Module({
  imports: [PermissionsModule],
  providers: [RolesRepository, RolesService],
  exports: [RolesRepository, RolesService],
})
export class RolesModule {}
