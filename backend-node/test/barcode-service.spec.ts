import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BarcodeService } from '../src/barcode/barcode.service';
import { BARCODE_STATUS } from '../src/shared/constants/business.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('BarcodeService', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const repo = {
      nextSequence: vi.fn().mockResolvedValue(1),
      findAnyByCode: vi.fn().mockResolvedValue(null),
      findByCode: vi.fn(),
      create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => ({
        id: 'b1',
        ...data,
      })),
      updateStatus: vi.fn().mockImplementation(async (id: string, data: Record<string, unknown>) => ({
        id,
        code: 'DR-00000001',
        ...data,
      })),
      bumpSequenceAtLeast: vi.fn().mockResolvedValue({ prefix: 'DR', lastValue: 12 }),
      ...overrides.repo,
    };
    const settings = {
      getString: vi.fn(async (key: string, fallback: string) => fallback),
      getInt: vi.fn(async (_key: string, fallback: number) => fallback),
      ...overrides.settings,
    };
    const audit = { record: vi.fn().mockResolvedValue({}) };
    const service = new BarcodeService(repo as never, settings as never, audit as never);
    return { service, repo, settings, audit };
  }

  it('formats validates and reserves next code', async () => {
    const { service, repo, audit } = build();
    const format = await service.resolveFormat();
    expect(service.formatCode(1, format)).toBe('DR-00000001');
    expect(service.validateFormat('DR-00000001', format)).toBe(true);
    expect(service.validateFormat('bad')).toBe(false);
    expect(await service.isAvailable('DR-00000001')).toBe(true);

    const reserved = await service.reserveNext('u1');
    expect(reserved.status).toBe(BARCODE_STATUS.RESERVED);
    expect(repo.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('reserves explicit code and allocates/releases', async () => {
    const { service, repo } = build();
    await service.reserveCode('DR-00000012', 'u1');
    expect(repo.bumpSequenceAtLeast).toHaveBeenCalledWith('DR', 12);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000012',
      status: BARCODE_STATUS.RESERVED,
    });
    await service.allocate('DR-00000012', 'dress', 'd1', 'u1');
    await service.release('DR-00000012', 'u1');

    repo.findAnyByCode.mockResolvedValue({ id: 'x' });
    await expect(service.assertAvailable('DR-00000001')).rejects.toBeInstanceOf(BusinessException);
    await expect(service.reserveCode('!!!')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue(null);
    await expect(service.allocate('missing', 'dress', 'd1')).rejects.toBeInstanceOf(BusinessException);
    await expect(service.release('missing')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000012',
      status: BARCODE_STATUS.RELEASED,
    });
    await expect(service.allocate('DR-00000012', 'dress', 'd1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('skips collisions when reserving next', async () => {
    const { service, repo } = build();
    repo.nextSequence
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    repo.findAnyByCode
      .mockResolvedValueOnce({ id: 'taken' })
      .mockResolvedValueOnce(null);
    const row = await service.reserveNext();
    expect(row.code).toBe('DR-00000002');
  });

  it('rejects bad separator and padding', async () => {
    const { service } = build({
      settings: {
        getString: vi.fn(async (key: string) => (key === 'barcode.separator' ? '*' : 'DR')),
        getInt: vi.fn(async () => 8),
      },
    });
    await expect(service.resolveFormat()).rejects.toBeInstanceOf(BusinessException);
  });
});