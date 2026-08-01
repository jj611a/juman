import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginSession } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AppConfig } from '../../shared/types';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  resolveExpiry(rememberMe: boolean, now = new Date()): Date {
    const auth = this.config.getOrThrow<AppConfig>('app').auth;
    const days = rememberMe
      ? auth.rememberMeRefreshTokenExpireDays
      : auth.refreshTokenExpireDays;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  create(input: {
    userId: string;
    deviceName?: string;
    ipAddress?: string;
    rememberMe: boolean;
  }): Promise<LoginSession> {
    const now = new Date();
    return this.prisma.loginSession.create({
      data: {
        userId: input.userId,
        deviceName: input.deviceName,
        ipAddress: input.ipAddress,
        rememberMe: input.rememberMe,
        lastActivityAt: now,
        expiresAt: this.resolveExpiry(input.rememberMe, now),
      },
    });
  }

  async getActive(sessionId: string, userId: string): Promise<LoginSession | null> {
    const session = await this.prisma.loginSession.findFirst({
      where: {
        id: sessionId,
        userId,
        deletedAt: null,
        revokedAt: null,
      },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.loginSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  async revoke(sessionId: string, revokedBy?: string): Promise<void> {
    await this.prisma.loginSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedBy: revokedBy ?? null },
    });
  }

  async revokeAllForUser(userId: string, revokedBy?: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.loginSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        deletedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedBy: revokedBy ?? null },
    });
    return result.count;
  }
}
