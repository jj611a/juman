import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from '../src/auth/services/refresh-token.service';
import { OpaqueTokenService } from '../src/security/opaque-token.service';

describe('RefreshTokenService', () => {
  it('findActiveByToken returns null when missing', async () => {
    const opaque = new OpaqueTokenService();
    const prisma = {
      refreshToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const service = new RefreshTokenService(prisma as never, opaque);
    expect(await service.findActiveByToken('x')).toBeNull();
  });

  it('rotate revokes on reuse of already revoked token', async () => {
    const opaque = new OpaqueTokenService();
    const prisma = {
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const service = new RefreshTokenService(prisma as never, opaque);
    await expect(
      service.rotate({
        current: {
          id: 'rt1',
          userId: 'u1',
          sessionId: 's1',
          tokenHash: 'h',
          expiresAt: new Date(Date.now() + 1000),
          revokedAt: new Date(),
          replacedById: null,
          createdAt: new Date(),
        },
        expiresAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokeAllForUser and revokeSessionFamilyExcept update rows', async () => {
    const opaque = new OpaqueTokenService();
    const prisma = {
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const service = new RefreshTokenService(prisma as never, opaque);
    await service.revokeAllForUser('u1');
    await service.revokeSessionFamilyExcept('u1', 's-keep');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
  });
});
