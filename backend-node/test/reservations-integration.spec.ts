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

describe('Reservations integration (Phase 5.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemId = '';
  let barcodeValue = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-reservations-');
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
      .send({ fullName: 'Reservation Customer', phone: '07907654321' })
      .expect(201);
    customerId = customer.body.id;

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Reserved dress',
        status: 'active',
        rentalPrice: 3000,
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

  const window = () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    const checkout = new Date(start);
    checkout.setUTCDate(checkout.getUTCDate() + 1);
    const ret = new Date(checkout);
    ret.setUTCDate(ret.getUTCDate() + 3);
    return {
      startDate: start.toISOString(),
      expectedCheckoutDate: checkout.toISOString(),
      expectedReturnDate: ret.toISOString(),
    };
  };

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/reservations').expect(401);
  });

  it('creates confirmed reservation, rejects overlap, checkouts to rental', async () => {
    const dates = window();
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...dates,
        items: [{ itemId, barcode: barcodeValue }],
      })
      .expect(201);

    expect(created.body.reservationNumber).toMatch(/^RSV-\d{8}$/);
    expect(created.body.status).toBe('confirmed');
    expect(
      created.body.statusHistory.some(
        (h: { newStatus: string }) => h.newStatus === 'confirmed',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...dates,
        items: [{ itemId }],
      })
      .expect(409);

    const itemBefore = await prisma.item.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(itemBefore.lifecycleState).toBe('available');

    const checked = await request(app.getHttpServer())
      .post(`/reservations/${created.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer arrived' })
      .expect(200);
    expect(checked.body.status).toBe('checked_out');
    expect(checked.body.rental?.rentalNumber).toMatch(/^RENT-\d{8}$/);

    const itemOut = await prisma.item.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(itemOut.lifecycleState).toBe('rented');

    const rental = await prisma.rental.findFirst({
      where: { reservationId: created.body.id },
    });
    expect(rental?.status).toBe('active');
  });

  it('cancels and expires without inventory mutation', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Cancelable reserved',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    const dates = window();
    dates.startDate = new Date(
      Date.now() + 86400000 * 40,
    ).toISOString();
    dates.expectedCheckoutDate = new Date(
      Date.now() + 86400000 * 41,
    ).toISOString();
    dates.expectedReturnDate = new Date(
      Date.now() + 86400000 * 44,
    ).toISOString();

    const a = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...dates,
        items: [{ itemId: item.body.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/reservations/${a.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer cancelled' })
      .expect(200);

    const stillAvailable = await prisma.item.findUniqueOrThrow({
      where: { id: item.body.id },
    });
    expect(stillAvailable.lifecycleState).toBe('available');

    // cancelled ignored for conflict — new reservation same window OK
    const b = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        ...dates,
        items: [{ itemId: item.body.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/reservations/${b.body.id}/expire`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'no show' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/reservations')
      .query({ status: 'expired', customerId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects concurrent checkout of same reservation and rental conflict', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Concurrent reserved',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    const start = new Date(Date.now() + 86400000 * 60);
    const checkout = new Date(Date.now() + 86400000 * 61);
    const ret = new Date(Date.now() + 86400000 * 64);
    const body = {
      customerId,
      startDate: start.toISOString(),
      expectedCheckoutDate: checkout.toISOString(),
      expectedReturnDate: ret.toISOString(),
      items: [{ itemId: item.body.id }],
    };

    const rsv = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    // create overlapping walk-in rental draft window via rental module
    const rentalItem = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Rental conflict dress',
        status: 'active',
        generateBarcode: true,
      })
      .expect(201);

    // checkout reservation twice — second fails
    await request(app.getHttpServer())
      .post(`/reservations/${rsv.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${rsv.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);

    // rental on another item shouldn't block; rental on same item with overlap should
    await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: checkout.toISOString(),
        expectedReturnDate: ret.toISOString(),
        items: [{ itemId: rentalItem.body.id }],
      })
      .expect(201);
  });
});
