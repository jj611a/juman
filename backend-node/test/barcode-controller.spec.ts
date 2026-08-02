import { describe, expect, it, vi } from 'vitest';
import { BarcodeController } from '../src/barcode/barcode.controller';
import { BARCODE_STATUS } from '../src/shared/constants/business.constants';

describe('BarcodeController', () => {
  const row = {
    id: 'b1',
    code: 'DR-00000001',
    type: 'code128',
    prefix: 'DR',
    status: BARCODE_STATUS.RESERVED,
    entityType: null,
    entityId: null,
    reservedAt: new Date(),
    activatedAt: null,
    retiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  };

  it('delegates all HTTP actions', async () => {
    const barcodes = {
      findMany: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      findPublic: vi.fn().mockResolvedValue({ id: 'b1', value: 'DR-00000001' }),
      generate: vi.fn().mockResolvedValue(row),
      validate: vi.fn().mockResolvedValue({ ok: true, value: 'DR-00000001', type: 'code128' }),
      reserve: vi.fn().mockResolvedValue(row),
      release: vi.fn().mockResolvedValue({ ...row, status: BARCODE_STATUS.RESERVED }),
      retire: vi.fn().mockResolvedValue({ ...row, status: BARCODE_STATUS.RETIRED }),
    };
    const controller = new BarcodeController(barcodes as never);
    const user = { userId: 'u1', username: 'admin' } as never;

    await controller.list({} as never);
    await controller.getById('b1');
    await controller.generate({ type: 'code128', prefix: 'DR' } as never, user);
    await controller.validate({ value: 'DR-00000001', type: 'code128' } as never, user);
    await controller.reserve({ value: 'DR-00000099', type: 'code128' } as never, user);
    await controller.release({ value: 'DR-00000001' } as never, user);
    await controller.retire({ value: 'DR-00000001' } as never, user);

    expect(barcodes.generate).toHaveBeenCalled();
    expect(barcodes.reserve).toHaveBeenCalled();
    expect(barcodes.release).toHaveBeenCalled();
    expect(barcodes.retire).toHaveBeenCalled();
  });
});
