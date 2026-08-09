import { Module } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}