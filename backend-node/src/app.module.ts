import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { configuration } from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logging/logger.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    LoggerModule,
    PrismaModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
