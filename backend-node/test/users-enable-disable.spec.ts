import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from '../src/users/users.service';

describe('UsersService enable/disable', () => {
  it('enable delegates to repository setActive', async () => {
    const repo = {
      setActive: vi.fn().mockResolvedValue({ id: 'u1', isActive: true }),
    };
    const prisma = { $transaction: vi.fn() };
    const service = new UsersService(
      repo as never,
      {} as never,
      {} as never,
      { getOrThrow: vi.fn() } as never,
      prisma as never,
    );

    await service.enableAccount('u1');
    expect(repo.setActive).toHaveBeenCalledWith('u1', true);
  });

  it('disableAccount revokes sessions and refresh tokens in one transaction', async () => {
    const repo = { setActive: vi.fn() };
    const tx = {
      user: { update: vi.fn().mockResolvedValue({ id: 'u1', isActive: false }) },
      loginSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new UsersService(
      repo as never,
      {} as never,
      {} as never,
      { getOrThrow: vi.fn() } as never,
      prisma as never,
    );

    await service.disableAccount('u1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalled();
    expect(tx.loginSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1' }),
      }),
    );
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1' }),
      }),
    );
    expect(repo.setActive).not.toHaveBeenCalled();
  });
});