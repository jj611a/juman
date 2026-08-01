import { Module } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

@Module({
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}