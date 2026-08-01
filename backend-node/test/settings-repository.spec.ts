import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { SettingsRepository } from '../src/settings/settings.repository';

describe('SettingsRepository', () => {
  it('delegates prisma calls', async () => {
    const prisma = {
      appSetting: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({ key: 'k' }),
        update: vi.fn().mockResolvedValue({ key: 'k', value: 'v' }),
      },
    };
    const repo = new SettingsRepository(prisma as never);
    await repo.findByKey('k');
    await repo.listActive('system');
    await repo.listActive();
    await repo.upsertSeed({
      key: 'k',
      value: 'v',
      valueType: 'string',
      category: 'system',
      description: 'd',
      isEditable: true,
    });
    await repo.updateValue('k', 'v2', 'u1');
    expect(prisma.appSetting.upsert).toHaveBeenCalled();
  });
});