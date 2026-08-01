import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
export interface HealthResponse { status: 'ok'|'degraded'; version: string; database: 'up'|'down'; uptime: number; }
@Injectable() export class HealthService { constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {} async getHealth(): Promise<HealthResponse> { let database: 'up'|'down' = 'up'; try { await this.prisma.$queryRaw`SELECT 1`; } catch { database = 'down'; } return { status: database === 'up' ? 'ok' : 'degraded', version: this.config.getOrThrow<string>('app.version'), database, uptime: Math.floor(process.uptime()) }; } }
