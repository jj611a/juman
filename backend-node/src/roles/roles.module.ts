import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [PermissionsModule],
  controllers: [RolesController],
  providers: [RolesRepository, RolesService],
  exports: [RolesService],
})
export class RolesModule {}