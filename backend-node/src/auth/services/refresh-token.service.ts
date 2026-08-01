import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OpaqueTokenService } from '../../security/opaque-token.service';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opaque: OpaqueTokenService,
  ) {}

  async issue(input: {
    userId: string;
    sessionId: string;
    expiresAt: Date;
  }): Promise<{ token: string; record: RefreshToken }> {
    const token = this.opaque.generate();
    const tokenHash = this.opaque.hash(token);
    const record = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return { token, record };
  }

  findActiveByToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = this.opaque.hash(token);
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Rotate refresh token inside a SQLite transaction with CAS on revokedAt.
   * Concurrent rotations of the same token revoke the family and fail closed.
   */
  async rotate(input: {
    current: RefreshToken;
    expiresAt: Date;
  }): Promise<{ token: string; record: RefreshToken }> {
    if (input.current.revokedAt) {
      await this.revokeSessionFamily(input.current.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const token = this.opaque.generate();
        const tokenHash = this.opaque.hash(token);
        const next = await tx.refreshToken.create({
          data: {
            userId: input.current.userId,
            sessionId: input.current.sessionId,
            tokenHash,
            expiresAt: input.expiresAt,
          },
        });

        const cas = await tx.refreshToken.updateMany({
          where: { id: input.current.id, revokedAt: null },
          data: {
            revokedAt: new Date(),
            replacedById: next.id,
          },
        });

        if (cas.count !== 1) {
          await tx.refreshToken.updateMany({
            where: { sessionId: input.current.sessionId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          throw new UnauthorizedException('Refresh token reuse detected');
        }

        return { token, record: next };
      });
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      await this.revokeSessionFamily(input.current.sessionId);
      throw error;
    }
  }

  async revokeSessionFamily(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeSessionFamilyExcept(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, sessionId: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Resolve a live refresh token.
   * Expired tokens fail as expired (no family revoke).
   * Already-revoked tokens trigger reuse detection + family revoke.
   */
  async assertNotReuse(token: string): Promise<RefreshToken> {
    const tokenHash = this.opaque.hash(token);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (existing.revokedAt) {
      await this.revokeSessionFamily(existing.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return existing;
  }
}