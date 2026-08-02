import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemsService } from '../src/inventory/items/items.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import { toItemPublic } from '../src/inventory/items/items.mapper';

const baseRow = {
  id: 'i1',
  internalCode: 'ITM-00000001',
  displayName: 'Item',
  purchasePrice: 0,
  rentalPrice: 0,
  salePrice: 0,
  condition: null,
  status: 'draft',
  lifecycleState: 'available',
  description: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: 'c1', name: 'Cat' },
  brand: { id: 'b1', name: 'Brand' },
  color: { id: 'col1', name: 'Red', hexCode: '#FF0000' },
  size: { id: 's1', name: 'M' },
  barcodes: [
    {
      id: 'ib1',
      isPrimary: true,
      barcode: { code: 'DR-00000001' },
    },
  ],
  media: [
    {
      id: 'im1',
      mediaFileId: 'm1',
      purpose: 'gallery',
      isPrimary: true,
      displayOrder: 0,
      mediaFile: {
        id: 'm1',
        originalFilename: 'a.jpg',
        mimeType: 'image/jpeg',
        relativePath: 'images/a.jpg',
      },
    },
  ],
};

describe('ItemsService', () => {
  const repo = {
    create: vi.fn(),
    createAtomic: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findAnyCode: vi.fn(),
    nextSequence: vi.fn(),
    findTaxonomy: vi.fn(),
    createBarcode: vi.fn(),
    softDelete: vi.fn(),
    softDeleteCascade: vi.fn(),
    restore: vi.fn(),
    restoreCascade: vi.fn(),
    list: vi.fn(),
    listMediaForItem: vi.fn(),
    listMediaForItems: vi.fn(),
  };
  const settings = {
    getString: vi.fn(async (_: string, f: string) => f),
    getInt: vi.fn(async (_: string, f: number) => f),
  };
  const audit = {
    recordCreate: vi.fn(),
    recordUpdate: vi.fn(),
    recordSoftDelete: vi.fn(),
    record: vi.fn(),
  };
  const barcode = {
    generate: vi.fn(),
    reserve: vi.fn(),
    activate: vi.fn(),
    release: vi.fn(),
  };
  const media = { find: vi.fn(), attach: vi.fn() };
  let service: ItemsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ItemsService(
      repo as never,
      settings as never,
      audit as never,
      barcode as never,
      media as never,
    );
    repo.nextSequence.mockResolvedValue(1);
    repo.findAnyCode.mockResolvedValue(null);
    repo.findTaxonomy.mockResolvedValue({ id: 't' });
    repo.createAtomic.mockResolvedValue(baseRow);
    repo.findById.mockResolvedValue(baseRow);
    repo.update.mockResolvedValue(baseRow);
    repo.softDeleteCascade.mockResolvedValue({
      ...baseRow,
      status: 'inactive',
      deletedAt: new Date(),
    });
    repo.restoreCascade.mockResolvedValue({ ...baseRow, status: 'active' });
    repo.list.mockResolvedValue({ rows: [baseRow], total: 1 });
    repo.listMediaForItem.mockResolvedValue(baseRow.media);
    repo.listMediaForItems.mockResolvedValue(new Map([['i1', baseRow.media]]));
  });

  it('maps public item shape', () => {
    const pub = toItemPublic(baseRow);
    expect(pub.barcodes[0].value).toBe('DR-00000001');
    expect(pub.color?.hexCode).toBe('#FF0000');
    expect(
      toItemPublic({
        ...baseRow,
        category: null,
        brand: null,
        color: null,
        size: null,
        barcodes: [],
        media: [],
      }).category,
    ).toBeNull();
  });

  it('creates with generateBarcode and reserve barcode atomically', async () => {
    barcode.generate.mockResolvedValue({ id: 'b1' });
    await service.create(
      {
        displayName: ' Catalog item ',
        purchasePrice: 1000,
        generateBarcode: true,
        condition: 'new',
      },
      { userId: 'u' } as never,
    );
    expect(repo.createAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ barcodeId: 'b1' }),
    );

    barcode.reserve.mockResolvedValue({ id: 'b2' });
    await service.create(
      { displayName: 'Manual', barcode: 'DR-99' },
      { userId: 'u' } as never,
    );
    expect(barcode.reserve).toHaveBeenCalled();
  });

  it('does not soft-delete when atomic create fails after barcode reserve', async () => {
    barcode.generate.mockResolvedValue({ id: 'b1' });
    repo.createAtomic.mockRejectedValue(new Error('tx fail'));
    await expect(
      service.create({ displayName: 'X', generateBarcode: true }),
    ).rejects.toThrow('tx fail');
    expect(repo.softDeleteCascade).not.toHaveBeenCalled();
  });

  it('rejects soft-delete while lifecycle is operational', async () => {
    repo.findById.mockResolvedValue({
      ...baseRow,
      status: 'active',
      lifecycleState: 'rented',
    });
    await expect(service.softDelete('i1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(repo.softDeleteCascade).not.toHaveBeenCalled();
  });

  it('rejects invalid money status condition and missing taxonomy', async () => {
    await expect(
      service.create({ displayName: 'x', salePrice: -1 }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ displayName: 'x', status: 'invalid' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ displayName: 'x', condition: 'broken' }),
    ).rejects.toBeInstanceOf(BusinessException);
    repo.findTaxonomy.mockResolvedValue(null);
    await expect(
      service.create({ displayName: 'x', categoryId: 'missing' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('updates soft-deletes restores and looks up by code', async () => {
    await service.update(
      'i1',
      {
        displayName: 'Updated',
        description: '  ',
        status: 'active',
        condition: '',
        salePrice: 5,
      },
      { userId: 'u' } as never,
    );
    expect(audit.recordUpdate).toHaveBeenCalled();

    await service.softDelete('i1', { userId: 'u' } as never);
    expect(repo.softDeleteCascade).toHaveBeenCalled();
    await service.getPublicById('i1');

    repo.findByCode.mockResolvedValue(baseRow);
    expect((await service.getByInternalCode('itm-00000001')).internalCode).toBe(
      'ITM-00000001',
    );
    repo.findByCode.mockResolvedValue(null);
    await expect(service.getByInternalCode('missing')).rejects.toBeInstanceOf(
      BusinessException,
    );

    repo.findById.mockResolvedValue({ ...baseRow, deletedAt: new Date() });
    await service.restore('i1', { userId: 'u' } as never);
    expect(repo.restoreCascade).toHaveBeenCalled();

    repo.findById.mockResolvedValue(null);
    await expect(service.restore('missing')).rejects.toBeInstanceOf(
      BusinessException,
    );
    repo.findById.mockResolvedValue({ ...baseRow, deletedAt: null });
    await expect(service.restore('i1')).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('filters searches and attaches media via MediaReference only', async () => {
    await service.list({
      q: 'Item',
      barcode: 'CODE',
      categoryId: 'c',
      brandId: 'b',
      status: 'active',
      displayName: 'Item',
      internalCode: 'ITM',
      deleted: 'true',
      sortBy: 'displayName',
      sortDir: 'asc',
    });
    expect(repo.list).toHaveBeenCalled();
    await expect(service.search({})).rejects.toBeInstanceOf(BusinessException);
    await service.search({ q: 'Blue' });

    repo.findById.mockResolvedValue(baseRow);
    media.find.mockResolvedValue({ id: 'm1' });
    media.attach.mockResolvedValue({ id: 'ref1' });
    await service.attachMedia(
      'i1',
      { mediaFileId: 'm1' },
      { userId: 'u' } as never,
    );
    expect(media.attach).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'item' }),
    );
    expect(repo.createMedia).toBeUndefined();
  });

  it('handles code allocation collisions and bad settings', async () => {
    repo.findAnyCode
      .mockResolvedValueOnce({ id: 'taken' })
      .mockResolvedValueOnce(null);
    repo.nextSequence.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await service.create({ displayName: 'Retry' });

    settings.getString.mockImplementation(
      async (key: string, fallback: string) => {
        if (key === 'inventory.item.prefix') return 'bad-prefix';
        return fallback;
      },
    );
    await expect(
      service.create({ displayName: 'X' }),
    ).rejects.toBeInstanceOf(BusinessException);

    settings.getString.mockImplementation(async (_k: string, f: string) => f);
    repo.findAnyCode.mockResolvedValue({ id: 'taken' });
    await expect(
      service.create({ displayName: 'X' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });
});
