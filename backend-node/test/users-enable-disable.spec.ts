import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from '../src/users/users.service';

describe('UsersService enable/disable', () => {
  it('delegates enable and disable to repository setActive', async () => {
    const repo = {
      setActive: vi.fn().mockResolvedValue({ id: 'u1', isActive: false }),
    };
    const service = new UsersService(
      repo as never,
      {} as never,
      {} as never,
      { getOrThrow: vi.fn() } as never,
    );

    await service.disableAccount('u1');
    expect(repo.setActive).toHaveBeenCalledWith('u1', false);

    await service.enableAccount('u1');
    expect(repo.setActive).toHaveBeenCalledWith('u1', true);
  });
});
