import { Module } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

@Module({
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsRepository, PermissionsService],
})
export class PermissionsModule {}
