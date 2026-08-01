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

  async rotate(input: {
    current: RefreshToken;
    expiresAt: Date;
  }): Promise<{ token: string; record: RefreshToken }> {
    if (input.current.revokedAt) {
      await this.revokeSessionFamily(input.current.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const next = await this.issue({
      userId: input.current.userId,
      sessionId: input.current.sessionId,
      expiresAt: input.expiresAt,
    });

    await this.prisma.refreshToken.update({
      where: { id: input.current.id },
      data: {
        revokedAt: new Date(),
        replacedById: next.record.id,
      },
    });

    return next;
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

  /**
   * Detect reuse of an already-rotated token and revoke the session family.
   */
  async assertNotReuse(token: string): Promise<RefreshToken> {
    const tokenHash = this.opaque.hash(token);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      await this.revokeSessionFamily(existing.sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return existing;
  }
}
