import { describe, expect, it, vi } from 'vitest';
import { ItemsController } from '../src/inventory/items/items.controller';
import { CategoriesController } from '../src/inventory/categories/categories.controller';
import { BrandsController } from '../src/inventory/brands/brands.controller';
import { ColorsController } from '../src/inventory/colors/colors.controller';
import { SizesController } from '../src/inventory/sizes/sizes.controller';

describe('Inventory controllers', () => {
  const user = { userId: 'u1', username: 'admin' } as never;

  it('delegates items HTTP surface', async () => {
    const items = {
      list: vi.fn(),
      search: vi.fn(),
      getByInternalCode: vi.fn(),
      getPublicById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
      attachMedia: vi.fn(),
    };
    const c = new ItemsController(items as never);
    await c.list({} as never);
    await c.search({ q: 'x' } as never);
    await c.code('ITM-1');
    await c.get('id');
    await c.create({ displayName: 'x' } as never, user);
    await c.update('id', { displayName: 'y' } as never, user);
    await c.delete('id', user);
    await c.restore('id', user);
    await c.media('id', { mediaFileId: 'm' } as never, user);
    expect(items.attachMedia).toHaveBeenCalled();
  });

  it('delegates taxonomy HTTP surfaces', async () => {
    const service = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
    };
    for (const Ctor of [
      CategoriesController,
      BrandsController,
      ColorsController,
      SizesController,
    ]) {
      const c = new Ctor(service as never);
      await c.list({});
      await c.get('id');
      await c.create({ name: 'x' } as never, user);
      await c.update('id', { name: 'y' } as never, user);
      await c.delete('id', user);
      await c.restore('id', user);
    }
    expect(service.restore).toHaveBeenCalled();
  });
});
