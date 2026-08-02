import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CustomersRepository } from '../src/customers/customers.repository';

describe('CustomersRepository', () => {
  it('covers persistence helpers', async () => {
    const tx = {
      sequenceCounter: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ lastValue: 1 }),
        create: vi.fn().mockResolvedValue({ lastValue: 1 }),
        update: vi.fn().mockResolvedValue({ lastValue: 2 }),
      },
    };
    const prisma = {
      customer: {
        create: vi.fn().mockResolvedValue({ id: 'c1' }),
        update: vi.fn().mockResolvedValue({ id: 'c1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const repo = new CustomersRepository(prisma as never);
    await repo.create({ fullName: 'a', phone: 'p', phoneNormalized: '1', customerNumber: 'CUS-1' } as never);
    await repo.update('c1', { fullName: 'b' });
    await repo.findById('c1');
    await repo.findById('c1', { includeDeleted: true });
    await repo.findByNumber('CUS-1');
    await repo.findAnyByNumber('CUS-1');
    await repo.findActiveByPhoneNormalized('1');
    await repo.findActiveByPhoneNormalized('1', 'c1');
    expect(await repo.nextSequence('CUS')).toBe(1);
    expect(await repo.nextSequence('CUS')).toBe(2);
    await repo.softDelete('c1', 'u1');
    await repo.restore('c1', 'u1');
    await repo.list({ where: {}, orderBy: { createdAt: 'desc' }, offset: 0, limit: 10 });
    expect(repo.sortFieldToOrder('phone', 'asc')).toEqual({ phoneNormalized: 'asc' });
    expect(repo.sortFieldToOrder('fullName', 'desc')).toEqual({ fullName: 'desc' });
  });
});