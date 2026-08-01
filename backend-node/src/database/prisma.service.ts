import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AppLoggerService } from '../logging/app-logger.service';
import type { AppConfig } from '../shared/types';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(AppLoggerService) private readonly logger: AppLoggerService,
  ) {
    const app = config.getOrThrow<AppConfig>('app');
    super({ datasources: { db: { url: app.databaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.applySqlitePragmas();
    await this.$queryRaw`SELECT 1`;
    this.logger.startup('Prisma connected to SQLite');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.startup('Prisma disconnected');
  }

  private async applySqlitePragmas(): Promise<void> {
    // journal_mode returns a row — must use query, not execute.
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
    this.logger.startup('SQLite PRAGMAs applied (foreign_keys, WAL, busy_timeout)');
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}