import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';

describe('Inventory integration', () => {
  let app: INestApplication;
  let dir = '';
  let token = '';
  let categoryId = '';
  let brandId = '';
  let colorId = '';
  let sizeId = '';
  let itemId = '';
  let internalCode = '';
  let barcodeValue = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-inventory-');
    dir = p.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();

    let r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Juman!Bootstrap1' });
    token = r.body.accessToken;
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Juman!Bootstrap1', newPassword: 'NewStrong!Pass1' });
    r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1' });
    token = r.body.accessToken;
  }, 180_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/items').expect(401);
  });

  it('creates taxonomy item filters search and restore', async () => {
    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Evening', nameEn: 'Evening' })
      .expect(201);
    categoryId = category.body.id;

    const brand = await request(app.getHttpServer())
      .post('/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Atelier' })
      .expect(201);
    brandId = brand.body.id;

    const color = await request(app.getHttpServer())
      .post('/colors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Navy', hexCode: '#001F3F' })
      .expect(201);
    colorId = color.body.id;

    const size = await request(app.getHttpServer())
      .post('/sizes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'M', sortOrder: 3 })
      .expect(201);
    sizeId = size.body.id;

    await request(app.getHttpServer())
      .get('/brands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/colors/${colorId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/sizes/${sizeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'M' })
      .expect(200);

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Blue catalog item',
        categoryId,
        brandId,
        colorId,
        sizeId,
        purchasePrice: 1000,
        rentalPrice: 2000,
        salePrice: 5000,
        condition: 'good',
        generateBarcode: true,
      })
      .expect(201);
    itemId = item.body.id;
    internalCode = item.body.internalCode;
    expect(internalCode).toMatch(/^ITM-\d{8}$/);
    expect(item.body.barcodes).toHaveLength(1);
    barcodeValue = item.body.barcodes[0].value;

    await request(app.getHttpServer())
      .get(`/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/items/code/${internalCode}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/items')
      .query({ categoryId, brandId, status: 'draft', barcode: barcodeValue.slice(0, 3) })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = list.body.items as Array<{ id: string }>;
    expect(items.some((x) => x.id === itemId)).toBe(true);

    await request(app.getHttpServer())
      .get('/items/search')
      .query({ q: 'Blue' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active', displayName: 'Blue catalog item updated' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'bad', salePrice: -1 })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/items/${itemId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/brands/${brandId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/brands/${brandId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/colors/${colorId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/colors/${colorId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/sizes/${sizeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/sizes/${sizeId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/categories/${categoryId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('transitions lifecycle, rejects invalid edges, records history', async () => {
    const created = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Lifecycle item', status: 'active' })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.lifecycleState).toBe('available');

    const state = await request(app.getHttpServer())
      .get(`/items/${id}/state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(state.body.isRentable).toBe(true);

    await request(app.getHttpServer())
      .post(`/items/${id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'rented', reason: 'skip reserved' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/items/${id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'reserved', reason: 'hold', expectedState: 'available' })
      .expect(200);

    const reserved = await request(app.getHttpServer())
      .get(`/items/${id}/state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(reserved.body.lifecycleState).toBe('reserved');
    expect(reserved.body.isRentable).toBe(false);

    await request(app.getHttpServer())
      .patch(`/items/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'should fail' })
      .expect(409);

    const history = await request(app.getHttpServer())
      .get(`/items/${id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.meta.total).toBeGreaterThanOrEqual(2);

    const LifecycleService = (await import('../src/inventory/lifecycle/lifecycle.service'))
      .LifecycleService;
    const lifecycle = app.get(LifecycleService);
    const results = await Promise.allSettled([
      lifecycle.transition(id, { newState: 'rented', expectedState: 'reserved' }),
      lifecycle.transition(id, { newState: 'available', expectedState: 'reserved' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});
