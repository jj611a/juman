import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxonomyRepository, TaxonomyService } from '../src/inventory/taxonomy';
import { BusinessException } from '../src/shared/errors/business.exception';
import { CategoriesService } from '../src/inventory/categories/categories.service';
import { BrandsService } from '../src/inventory/brands/brands.service';
import { ColorsService } from '../src/inventory/colors/colors.service';
import { SizesService } from '../src/inventory/sizes/sizes.service';
import { CategoriesRepository } from '../src/inventory/categories/categories.repository';
import { BrandsRepository } from '../src/inventory/brands/brands.repository';
import { ColorsRepository } from '../src/inventory/colors/colors.repository';
import { SizesRepository } from '../src/inventory/sizes/sizes.repository';

describe('TaxonomyService', () => {
  const repo = {
    find: vi.fn(),
    findAnyName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
  };
  const audit = {
    recordCreate: vi.fn(),
    recordUpdate: vi.fn(),
    recordSoftDelete: vi.fn(),
    record: vi.fn(),
  };
  let colorService: TaxonomyService;
  let categoryService: TaxonomyService;

  beforeEach(() => {
    vi.clearAllMocks();
    colorService = new TaxonomyService(repo as never, audit as never, 'color');
    categoryService = new TaxonomyService(repo as never, audit as never, 'category');
    repo.findAnyName.mockResolvedValue(null);
    repo.create.mockImplementation(async (d: Record<string, unknown>) => ({
      id: 'c1',
      ...d,
      deletedAt: null,
    }));
    repo.find.mockResolvedValue({ id: 'c1', name: 'Red', deletedAt: null });
    repo.update.mockImplementation(async (id: string, d: Record<string, unknown>) => ({
      id,
      name: 'Red',
      ...d,
    }));
    repo.list.mockResolvedValue({ rows: [{ id: 'c1', name: 'Red' }], total: 1 });
    repo.softDelete.mockResolvedValue({ id: 'c1', deletedAt: new Date() });
    repo.restore.mockResolvedValue({ id: 'c1', deletedAt: null });
  });

  it('creates updates lists soft-deletes and restores', async () => {
    const created = await colorService.create({
      name: ' Red ',
      hexCode: '#ff0000',
      description: '  ',
      isActive: true,
    });
    expect(created.hexCode).toBe('#FF0000');
    await expect(
      colorService.create({ name: 'Blue', hexCode: '#fff' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(colorService.create({ name: '  ' })).rejects.toBeInstanceOf(BusinessException);

    await colorService.update('c1', { name: 'Crimson', hexCode: '' }, { userId: 'u' } as never);
    await colorService.getById('c1');
    await colorService.softDelete('c1', { userId: 'u' } as never);

    const page = await colorService.list({ q: 're', deleted: true, offset: 0, limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.meta.total).toBe(1);

    repo.find.mockResolvedValue({ id: 'c1', name: 'Red', deletedAt: new Date() });
    await colorService.restore('c1');
    expect(audit.record).toHaveBeenCalled();

    repo.find.mockResolvedValue(null);
    await expect(colorService.restore('x')).rejects.toBeInstanceOf(BusinessException);
    repo.find.mockResolvedValue({ id: 'c1', name: 'Red', deletedAt: null });
    await expect(colorService.restore('c1')).rejects.toBeInstanceOf(BusinessException);
  });

  it('enforces category parent rules and duplicate names', async () => {
    repo.find.mockResolvedValue({ id: 'parent', name: 'Parent', deletedAt: null });
    await categoryService.create({ name: 'Child', parentId: 'parent', nameEn: 'Child', sortOrder: 2 });

    repo.find.mockResolvedValue({ id: 'c1', name: 'Cat', deletedAt: null });
    await expect(
      categoryService.update('c1', { parentId: 'c1' }),
    ).rejects.toBeInstanceOf(BusinessException);

    await categoryService.list({ parentId: '', q: 'x' });
    repo.findAnyName.mockResolvedValue({ id: 'other' });
    await expect(categoryService.create({ name: 'dup' })).rejects.toBeInstanceOf(BusinessException);
  });
});

describe('TaxonomyRepository', () => {
  it('covers model operations for category and brand orderings', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: '1', name: 'A' }]);
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      category: {
        create: vi.fn().mockResolvedValue({ id: '1' }),
        update: vi.fn().mockResolvedValue({ id: '1' }),
        findFirst: vi.fn().mockResolvedValue({ id: '1', name: 'A' }),
        findMany,
        count,
      },
      brand: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: '1', name: ' Brand ' }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const cats = new TaxonomyRepository(prisma as never, 'category');
    await cats.create({ name: 'A' });
    await cats.update('1', { name: 'B' });
    await cats.find('1');
    await cats.find('1', true);
    await cats.findAnyName('a');
    await cats.list({ deletedAt: null }, 0, 10);
    await cats.softDelete('1', 'u');
    await cats.restore('1', 'u');

    const brands = new TaxonomyRepository(prisma as never, 'brand');
    expect(await brands.findAnyName('brand')).toEqual({ id: '1', name: ' Brand ' });
    await brands.list({}, 0, 5);
  });
});

describe('taxonomy subclass constructors', () => {
  it('wires kind-specific services', () => {
    const prisma = {} as never;
    const audit = {} as never;
    expect(new CategoriesService(new CategoriesRepository(prisma), audit)).toBeInstanceOf(
      TaxonomyService,
    );
    expect(new BrandsService(new BrandsRepository(prisma), audit)).toBeInstanceOf(TaxonomyService);
    expect(new ColorsService(new ColorsRepository(prisma), audit)).toBeInstanceOf(TaxonomyService);
    expect(new SizesService(new SizesRepository(prisma), audit)).toBeInstanceOf(TaxonomyService);
  });
});
