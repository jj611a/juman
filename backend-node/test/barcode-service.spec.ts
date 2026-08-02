import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeService } from '../src/barcode/barcode.service';
import { BARCODE_TYPE } from '../src/barcode/barcode.constants';
import { BARCODE_STATUS } from '../src/shared/constants/business.constants';
import { BusinessException } from '../src/shared/errors/business.exception';

describe('BarcodeService', () => {
  const repo = {
    nextSequence: vi.fn(),
    findAnyByCode: vi.fn(),
    findByCode: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    bumpSequenceAtLeast: vi.fn(),
  };
  const settings = {
    getString: vi.fn(async (key: string, fallback: string) =>
      key === 'barcode.default_type' ? 'code128' : fallback,
    ),
    getInt: vi.fn(async (_k: string, fallback: number) => fallback),
  };
  const audit = { record: vi.fn().mockResolvedValue({}) };
  let service: BarcodeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BarcodeService(repo as never, settings as never, audit as never);
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyByCode.mockResolvedValue(null);
    repo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'b1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    repo.update.mockImplementation(async (id: string, data: Record<string, unknown>) => ({
      id,
      code: 'DR-00000001',
      type: 'code128',
      ...data,
    }));
    repo.list.mockResolvedValue({ rows: [], total: 0 });
    repo.bumpSequenceAtLeast.mockResolvedValue({ prefix: 'DR', lastValue: 12 });
  });

  it('generates reserves activates releases retires', async () => {
    const format = await service.resolveFormat();
    expect(service.formatCode(1, format)).toBe('DR-00000001');
    expect(service.normalize(' dr-1 ', BARCODE_TYPE.CODE128)).toBe('DR-1');
    expect(service.validateFormat('DR-00000001')).toBe(true);
    expect(service.validateFormat('DR-00000001', format)).toBe(true);
    expect(service.validateFormat('NOPE', format)).toBe(false);

    const generated = await service.generate({}, { userId: 'u1' } as never);
    expect(generated.status).toBe(BARCODE_STATUS.RESERVED);
    expect(audit.record).toHaveBeenCalled();

    await service.reserve({ value: 'DR-00000012' }, { userId: 'u1' } as never);
    expect(repo.bumpSequenceAtLeast).toHaveBeenCalledWith('DR', 12);

    await service.reserve({ overrides: { prefix: 'XX', separator: '-', padding: 4 } });

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000012',
      status: BARCODE_STATUS.RESERVED,
      type: 'code128',
    });
    await service.activate('DR-00000012', 'dress', 'd1', { userId: 'u1' } as never);
    await service.allocate('DR-00000012', 'dress', 'd1', 'u1');

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000012',
      status: BARCODE_STATUS.ACTIVATED,
      entityType: 'dress',
      entityId: 'd1',
    });
    await service.release('DR-00000012', { userId: 'u1' } as never);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000012',
      status: BARCODE_STATUS.RESERVED,
    });
    await service.retire('DR-00000012', { userId: 'u1' } as never);

    expect(await service.exists('missing')).toBe(false);
    expect(await service.isAvailable('missing')).toBe(true);
  });

  it('validates and rejects duplicates and bad states', async () => {
    const ok = await service.validate('DR-00000001', 'code128');
    expect(ok.ok).toBe(true);
    await service.validate('12345', 'code128');

    const bad = await service.validate(String.fromCharCode(1), 'code128');
    expect(bad.ok).toBe(false);
    expect(audit.record).toHaveBeenCalled();

    const badType = await service.validate('x', 'notatype');
    expect(badType.ok).toBe(false);

    repo.findAnyByCode.mockResolvedValue({ id: 'x' });
    await expect(service.assertAvailable('DR-00000001')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-1',
      status: BARCODE_STATUS.RETIRED,
    });
    await expect(service.activate('DR-1', 'dress', 'd1')).rejects.toBeInstanceOf(BusinessException);
    await expect(service.release('DR-1')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-1',
      status: BARCODE_STATUS.ACTIVATED,
      entityType: 'dress',
      entityId: 'other',
    });
    await expect(service.activate('DR-1', 'dress', 'd2')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-1',
      status: BARCODE_STATUS.RESERVED,
    });
    await expect(service.release('DR-1')).rejects.toBeInstanceOf(BusinessException);

    repo.findByCode.mockResolvedValue({
      id: 'b1',
      code: 'DR-1',
      status: BARCODE_STATUS.RETIRED,
    });
    await expect(service.retire('DR-1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(null);
    repo.findByCode.mockResolvedValue(null);
    await expect(service.retire('missing')).rejects.toBeInstanceOf(BusinessException);
    await expect(service.find('missing')).rejects.toBeInstanceOf(BusinessException);
    await expect(service.findByValue('missing')).rejects.toBeInstanceOf(BusinessException);
  });

  it('skips collisions and lists with filters', async () => {
    repo.nextSequence.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    repo.findAnyByCode.mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null);
    const row = await service.reserveNext();
    expect(row.code).toBe('DR-00000002');

    repo.findById.mockResolvedValue({
      id: 'b1',
      code: 'DR-00000002',
      type: 'code128',
      prefix: 'DR',
      status: 'reserved',
      entityType: null,
      entityId: null,
      reservedAt: new Date(),
      activatedAt: null,
      retiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    });
    const pub = await service.findPublic('b1');
    expect(pub.value).toBe('DR-00000002');

    repo.findByCode.mockResolvedValue(repo.findById.mock.results[0].value);
    expect((await service.findByValue('DR-00000002')).id).toBe('b1');

    repo.list.mockResolvedValue({ rows: [repo.findById.mock.results[0].value], total: 1 });
    const page = await service.findMany({
      q: 'DR',
      status: 'reserved',
      type: 'code128',
      entityType: 'dress',
      entityId: 'd1',
      prefix: 'dr',
      sortBy: 'code',
      sortDir: 'asc',
      offset: 0,
      limit: 10,
    });
    expect(page.meta.total).toBe(1);

    repo.findById.mockResolvedValueOnce({
      id: 'uuid-row',
      code: 'DR-9',
      status: BARCODE_STATUS.RESERVED,
    });
    await service.retire('uuid-row');
  });

  it('rejects bad separator ean generate and format edges', async () => {
    settings.getString.mockImplementation(async (key: string, fallback: string) => {
      if (key === 'barcode.separator') return '*';
      if (key === 'barcode.default_type') return 'code128';
      return fallback;
    });
    await expect(service.resolveFormat()).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (key: string, fallback: string) =>
      key === 'barcode.default_type' ? 'code128' : fallback,
    );
    await expect(service.generate({ type: BARCODE_TYPE.EAN13 })).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.generate({ type: BARCODE_TYPE.EAN8 })).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.generate({ type: BARCODE_TYPE.UPC_A })).rejects.toBeInstanceOf(
      BusinessException,
    );

    expect(() => service.formatCode(0, { prefix: 'DR', separator: '-', padding: 8 })).toThrow(
      BusinessException,
    );

    settings.getString.mockImplementation(async (key: string, fallback: string) => {
      if (key === 'barcode.default_type') return 'bogus';
      return fallback;
    });
    await expect(service.resolveDefaultType()).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (key: string, fallback: string) =>
      key === 'barcode.default_type' ? 'code128' : fallback,
    );
    await expect(service.reserve({ type: 'nope' as never })).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('exhausts sequence attempts when all codes taken', async () => {
    repo.findAnyByCode.mockResolvedValue({ id: 'taken' });
    repo.nextSequence.mockResolvedValue(1);
    await expect(service.reserveNext()).rejects.toBeInstanceOf(BusinessException);
  });

  it('reserves explicit gtin and custom prefix codes', async () => {
    await service.reserveCode('4006381333931', 'u1', BARCODE_TYPE.EAN13);
    expect(repo.create).toHaveBeenCalled();

    await service.reserveCode('CUSTOM99', 'u1', BARCODE_TYPE.CODE128);
    expect(repo.bumpSequenceAtLeast).toHaveBeenCalled();
  });
});
