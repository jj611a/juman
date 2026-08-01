import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppLoggerService } from './common/logger/app-logger.service';
import { configuration } from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnvironment }), PrismaModule, HealthModule], providers: [AppLoggerService] }) export class AppModule {}
