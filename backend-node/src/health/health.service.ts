import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import type {
  AppConfig,
  DatabaseHealthStatus,
  HealthStatus,
} from '../shared/types';

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  database: DatabaseHealthStatus;
  uptime: number;
  environment: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const app = this.config.getOrThrow<AppConfig>('app');
    const connected = await this.prisma.verifyConnection();
    const database: DatabaseHealthStatus = connected ? 'connected' : 'disconnected';

    return {
      status: connected ? 'ok' : 'degraded',
      version: app.version,
      database,
      uptime: Number(process.uptime().toFixed(1)),
      environment: app.environment,
    };
  }
}
