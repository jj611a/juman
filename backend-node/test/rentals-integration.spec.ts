import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';
import { PrismaService } from '../src/database/prisma.service';
import { LifecycleService } from '../src/inventory/lifecycle/lifecycle.service';

describe('Rentals workflow integration (Phase 5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemId = '';
  let barcodeValue = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-rentals-');
    dir = p.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);

    let r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Juman!Bootstrap1' });
    token = r.body.accessToken;
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'Juman!Bootstrap1',
        newPassword: 'NewStrong!Pass1',
      });
    r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1' });
    token = r.body.accessToken;

    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Rental Customer', phone: '07901234567' })
      .expect(201);
    customerId = customer.body.id;

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Rental dress',
        status: 'active',
        rentalPrice: 5000,
        generateBarcode: true,
      })
      .expect(201);
    itemId = item.body.id;
    barcodeValue = item.body.barcodes[0].value;
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
    await request(app.getHttpServer()).get('/rentals').expect(401);
  });

  it('creates draft, checkouts, returns, and syncs inventory lifecycle', async () => {
    const draft = await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        items: [{ itemId, barcode: barcodeValue }],
      })
      .expect(201);

    expect(draft.body.rentalNumber).toMatch(/^RENT-\d{8}$/);
    expect(draft.body.status).toBe('draft');

    const itemBefore = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(itemBefore.lifecycleState).toBe('available');

    const checked = await request(app.getHttpServer())
      .post(`/rentals/${draft.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'walk-in' })
      .expect(200);
    expect(checked.body.status).toBe('active');
    expect(checked.body.statusHistory.some((h: { newStatus: string }) => h.newStatus === 'checked_out')).toBe(
      true,
    );

    const itemOut = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(itemOut.lifecycleState).toBe('rented');

    const returned = await request(app.getHttpServer())
      .post(`/rentals/${draft.body.id}/return`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer returned' })
      .expect(200);
    expect(returned.body.status).toBe('return_pending');
    expect(returned.body.actualReturnDate).toBeTruthy();

    const itemReturn = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    expect(itemReturn.lifecycleState).toBe('return_pending');

    await request(app.getHttpServer())
      .get(`/rentals/${draft.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/rentals')
      .query({ status: 'return_pending', customerId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('cancels draft without touching inventory; cancels active with inventory release path', async () => {
    // restore item to available for next scenarios
    await prisma.item.update({
      where: { id: itemId },
      data: { lifecycleState: 'available' },
    });

    const item2 = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Cancel dress',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ itemId: item2.body.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer changed mind' })
      .expect(200);

    const stillAvailable = await prisma.item.findUniqueOrThrow({
      where: { id: item2.body.id },
    });
    expect(stillAvailable.lifecycleState).toBe('available');

    const item3 = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Active cancel dress',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    const draft2 = await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ itemId: item3.body.id }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rentals/${draft2.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/rentals/${draft2.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'abort outbound' })
      .expect(200);

    const released = await prisma.item.findUniqueOrThrow({
      where: { id: item3.body.id },
    });
    expect(released.lifecycleState).toBe('available');
  });

  it('rejects overlapping draft create and concurrent checkout of same rental', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Busy dress',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    const window = {
      rentalDate: new Date().toISOString(),
      expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const draftA = await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...window,
        items: [{ itemId: item.body.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...window,
        items: [{ itemId: item.body.id }],
      })
      .expect(409);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/rentals/${draftA.body.id}/checkout`)
        .set('Authorization', `Bearer ${token}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/rentals/${draftA.body.id}/checkout`)
        .set('Authorization', `Bearer ${token}`)
        .send({}),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);

    const lifecycle = app.get(LifecycleService);
    expect(lifecycle.canTransition('available', 'reserved')).toBe(true);
  });

  it('rejects draft lifecycle misuse and bad create payloads', async () => {
    await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() - 86400000).toISOString(),
        items: [{ itemId }],
      })
      .expect(400);

    const draftItem = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Draft only', status: 'draft', generateBarcode: true })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ itemId: draftItem.body.id }],
      })
      .expect(409);
  });
});
