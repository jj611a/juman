import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AuditRepository } from '../src/audit/audit.repository';

describe('AuditRepository', () => {
  it('creates and lists', async () => {
    const prisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'a1' }),
        findMany: vi.fn().mockResolvedValue([{ id: 'a1' }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const repo = new AuditRepository(prisma as never);
    await repo.create({
      module: 'm',
      entityType: 'e',
      entityId: '1',
      action: 'create',
      oldValues: null,
      newValues: null,
      userId: null,
      username: null,
      ipAddress: null,
      metadata: null,
      message: null,
    });
    const listed = await repo.list({
      module: 'm',
      entityType: 'e',
      entityId: '1',
      action: 'create',
      offset: 0,
      limit: 10,
    });
    expect(listed.total).toBe(1);
  });
});