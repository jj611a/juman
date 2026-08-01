import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../src/audit/audit.service';
import { AUDIT_ACTION } from '../src/shared/constants/business.constants';

describe('AuditService', () => {
  it('records normalized audit events', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
      list: vi.fn().mockResolvedValue({ rows: [{ id: 'a1' }], total: 1 }),
    };
    const service = new AuditService(repo as never);

    await service.record({
      module: 'Inventory',
      entityType: 'Dress',
      entityId: 'd1',
      action: AUDIT_ACTION.CREATE,
      newValues: { name: 'x' },
      metadata: { source: 'test' },
      actor: { userId: 'u1', username: 'Admin', ipAddress: '127.0.0.1' },
      message: 'created',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'inventory',
        entityType: 'dress',
        action: 'create',
        username: 'admin',
        newValues: '{"name":"x"}',
        metadata: '{"source":"test"}',
      }),
    );

    await service.recordCreate('m', 'e', '1', { a: 1 });
    await service.recordUpdate('m', 'e', '1', { a: 1 }, { a: 2 });
    await service.recordSoftDelete('m', 'e', '1', { a: 1 });

    const page = await service.list({ module: 'inventory', limit: 10 });
    expect(page.meta.total).toBe(1);
    expect(page.items).toHaveLength(1);
  });
});