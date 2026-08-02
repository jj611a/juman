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

describe('Settlement engine integration (Phase 6.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemId = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-settlement-');
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
      .send({ fullName: 'Settlement Customer', phone: '07901112233' })
      .expect(201);
    customerId = customer.body.id;

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Settlement dress',
        status: 'active',
        rentalPrice: 5000,
        generateBarcode: true,
      })
      .expect(201);
    itemId = item.body.id;
  }, 180_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function checkoutRental(opts?: {
    depositFils?: number;
    price?: number;
    daysOffset?: number;
  }) {
    const offset = opts?.daysOffset ?? 0;
    const item =
      opts?.price != null
        ? (
            await request(app.getHttpServer())
              .post('/items')
              .set(auth())
              .send({
                displayName: `Settle item ${Date.now()}`,
                status: 'active',
                rentalPrice: opts.price,
                generateBarcode: true,
              })
              .expect(201)
          ).body.id
        : itemId;

    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: new Date(Date.now() + 86400000 * (10 + offset)).toISOString(),
        expectedReturnDate: new Date(
          Date.now() + 86400000 * (12 + offset),
        ).toISOString(),
        items: [{ itemId: item, agreedRentalPrice: opts?.price ?? 5000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set(auth())
      .send(
        opts?.depositFils != null ? { depositAmountFils: opts.depositFils } : {},
      )
      .expect(200);

    return rental.body.id as string;
  }

  it('checkout creates settlement; payment updates balances; close completes', async () => {
    await request(app.getHttpServer()).get('/settlements').expect(401);

    const rentalId = await checkoutRental({ depositFils: 1000, daysOffset: 0 });

    const list = await request(app.getHttpServer())
      .get('/settlements')
      .query({ rentalId })
      .set(auth())
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    const settlement = list.body.items[0];
    expect(settlement.status).toBe('open');
    // 5000 charge - 1000 deposit
    expect(settlement.totalFils).toBe(4000);
    expect(settlement.remainingFils).toBe(4000);

    const partial = await request(app.getHttpServer())
      .post(`/settlements/${settlement.id}/payment`)
      .set(auth())
      .send({ amountFils: 1500, method: 'cash' })
      .expect(200);
    expect(partial.body.status).toBe('partially_paid');
    expect(partial.body.paidFils).toBe(1500);
    expect(partial.body.remainingFils).toBe(2500);

    const paid = await request(app.getHttpServer())
      .post(`/settlements/${settlement.id}/payment`)
      .set(auth())
      .send({ amountFils: 2500 })
      .expect(200);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.remainingFils).toBe(0);

    const detail = await request(app.getHttpServer())
      .get(`/settlements/${settlement.id}`)
      .set(auth())
      .expect(200);
    expect(detail.body.history.length).toBeGreaterThanOrEqual(2);

    await request(app.getHttpServer())
      .post(`/settlements/${settlement.id}/close`)
      .set(auth())
      .send({ reason: 'books closed' })
      .expect(200);

    const closed = await request(app.getHttpServer())
      .get(`/settlements/${settlement.id}`)
      .set(auth())
      .expect(200);
    expect(closed.body.status).toBe('closed');

    // Rental return then complete gated by settlement
    await request(app.getHttpServer())
      .post(`/rentals/${rentalId}/return`)
      .set(auth())
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/rentals/${rentalId}/complete`)
      .set(auth())
      .send({})
      .expect(200);

    const rental = await request(app.getHttpServer())
      .get(`/rentals/${rentalId}`)
      .set(auth())
      .expect(200);
    expect(rental.body.status).toBe('completed');
  });

  it('rejects rental complete while settlement is open', async () => {
    const rentalId = await checkoutRental({ daysOffset: 5, price: 3000 });

    await request(app.getHttpServer())
      .post(`/rentals/${rentalId}/return`)
      .set(auth())
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/rentals/${rentalId}/complete`)
      .set(auth())
      .send({})
      .expect(409);
  });

  it('supports concurrent settlement payments with balance consistency', async () => {
    const rentalId = await checkoutRental({ daysOffset: 20, price: 10000 });
    const list = await request(app.getHttpServer())
      .get('/settlements')
      .query({ rentalId })
      .set(auth())
      .expect(200);
    const settlementId = list.body.items[0].id as string;
    const before = list.body.items[0].remainingFils as number;

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/settlements/${settlementId}/payment`)
        .set(auth())
        .send({ amountFils: 1000 }),
      request(app.getHttpServer())
        .post(`/settlements/${settlementId}/payment`)
        .set(auth())
        .send({ amountFils: 1000 }),
      request(app.getHttpServer())
        .post(`/settlements/${settlementId}/payment`)
        .set(auth())
        .send({ amountFils: 1000 }),
    ]);
    const ok = results.filter((r) => r.status === 200);
    expect(ok.length).toBe(3);

    const after = await request(app.getHttpServer())
      .get(`/settlements/${settlementId}`)
      .set(auth())
      .expect(200);
    expect(after.body.remainingFils).toBe(before - 3000);
    expect(after.body.paidFils).toBe(3000);
    expect(after.body.paidFils + after.body.remainingFils).toBe(
      after.body.totalFils,
    );
  });

  it('cancels open settlement and rolls back rejected overpayment', async () => {
    const rentalId = await checkoutRental({ daysOffset: 40, price: 2000 });
    const list = await request(app.getHttpServer())
      .get('/settlements')
      .query({ rentalId })
      .set(auth())
      .expect(200);
    const settlementId = list.body.items[0].id as string;

    const beforePays = await prisma.payment.count();
    await request(app.getHttpServer())
      .post(`/settlements/${settlementId}/payment`)
      .set(auth())
      .send({ amountFils: 99999 })
      .expect(400);
    const afterPays = await prisma.payment.count();
    expect(afterPays).toBe(beforePays);

    await request(app.getHttpServer())
      .post(`/settlements/${settlementId}/cancel`)
      .set(auth())
      .send({ reason: 'void' })
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .get(`/settlements/${settlementId}`)
      .set(auth())
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');

    await request(app.getHttpServer())
      .post(`/settlements/${settlementId}/payment`)
      .set(auth())
      .send({ amountFils: 100 })
      .expect(409);
  });

  it('blocks cancel after payment applied', async () => {
    const rentalId = await checkoutRental({ daysOffset: 60, price: 2500 });
    const list = await request(app.getHttpServer())
      .get('/settlements')
      .query({ rentalId })
      .set(auth())
      .expect(200);
    const settlementId = list.body.items[0].id as string;

    await request(app.getHttpServer())
      .post(`/settlements/${settlementId}/payment`)
      .set(auth())
      .send({ amountFils: 500 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/settlements/${settlementId}/cancel`)
      .set(auth())
      .send({})
      .expect(409);
  });
});
