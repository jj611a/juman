import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [SecurityModule],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
