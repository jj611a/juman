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

describe('Financial domain completion (Phase 6.6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-fin-domain-');
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
      .send({ fullName: 'Domain Customer', phone: '07904445566' })
      .expect(201);
    customerId = customer.body.id;
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

  async function checkoutSettlement(price = 5000) {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set(auth())
      .send({
        displayName: `Dom ${Date.now()}`,
        status: 'active',
        rentalPrice: price,
        generateBarcode: true,
      })
      .expect(201);
    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: '2026-08-20T00:00:00.000Z',
        expectedReturnDate: '2026-08-22T00:00:00.000Z',
        items: [{ itemId: item.body.id }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set(auth())
      .send({ depositAmountFils: 1000 })
      .expect(200);
    const settlement = await prisma.rentalSettlement.findFirstOrThrow({
      where: { rentalId: rental.body.id },
    });
    return settlement;
  }

  it('applies discount, late fee, adjustment, refund through Settlement', async () => {
    const s = await checkoutSettlement(5000);
    expect(s.chargeFils).toBe(5000);
    expect(s.depositFils).toBe(1000);
    expect(s.totalFils).toBe(4000);

    const afterDiscount = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/discount`)
      .set(auth())
      .send({
        kind: 'fixed',
        amountFils: 500,
        reason: 'promo',
        idempotencyKey: `disc-${s.id}`,
      })
      .expect(200);
    expect(afterDiscount.body.discountFils).toBe(500);
    expect(afterDiscount.body.totalFils).toBe(3500);

    const afterLate = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/late-fee`)
      .set(auth())
      .send({
        kind: 'flat',
        flatFils: 200,
        reason: '1 day late',
        idempotencyKey: `late-${s.id}`,
      })
      .expect(200);
    expect(afterLate.body.lateFeeFils).toBe(200);
    expect(afterLate.body.totalFils).toBe(3700);

    const afterAdj = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/adjustment`)
      .set(auth())
      .send({
        amountFils: -200,
        reason: 'goodwill',
        idempotencyKey: `adj-${s.id}`,
      })
      .expect(200);
    expect(afterAdj.body.adjustmentFils).toBe(-200);
    expect(afterAdj.body.totalFils).toBe(3500);

    const afterRefund = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/refund`)
      .set(auth())
      .send({
        amountFils: 500,
        reason: 'credit note',
        idempotencyKey: `ref-${s.id}`,
      })
      .expect(200);
    expect(afterRefund.body.refundFils).toBe(500);
    expect(afterRefund.body.totalFils).toBe(3000);
    expect(afterRefund.body.remainingFils).toBe(3000);

    const refunds = await prisma.settlementRefund.count({
      where: { settlementId: s.id, status: 'posted' },
    });
    expect(refunds).toBe(1);
    const history = await prisma.settlementRefundHistory.count({
      where: { refund: { settlementId: s.id } },
    });
    expect(history).toBeGreaterThanOrEqual(1);

    // Idempotent replay
    const replay = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/refund`)
      .set(auth())
      .send({
        amountFils: 500,
        reason: 'credit note',
        idempotencyKey: `ref-${s.id}`,
      })
      .expect(200);
    expect(replay.body.refundFils).toBe(500);

    const paymentsBefore = await prisma.payment.count({
      where: { settlementId: s.id },
    });
    expect(paymentsBefore).toBe(0);
  });

  it('rejects modifiers that would push total below paid', async () => {
    const s = await checkoutSettlement(4000);
    await request(app.getHttpServer())
      .post(`/settlements/${s.id}/payment`)
      .set(auth())
      .send({ amountFils: 2500, idempotencyKey: `pay-${s.id}` })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/settlements/${s.id}/refund`)
      .set(auth())
      .send({ amountFils: 2000, reason: 'too much' })
      .expect(400);
  });

  it('percentage discount on rental basis', async () => {
    const s = await checkoutSettlement(10000);
    const res = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/discount`)
      .set(auth())
      .send({
        kind: 'percentage',
        basis: 'rental',
        percentBps: 1000,
        reason: '10 percent',
      })
      .expect(200);
    // rental basis = charge - deposit = 9000; 10% = 900
    expect(res.body.discountFils).toBe(900);
    expect(res.body.totalFils).toBe(8100);
  });

  it('daily late fee with max cap', async () => {
    const s = await checkoutSettlement(3000);
    const res = await request(app.getHttpServer())
      .post(`/settlements/${s.id}/late-fee`)
      .set(auth())
      .send({
        kind: 'daily',
        dailyFils: 100,
        daysCharged: 10,
        maxFils: 250,
        reason: 'capped',
      })
      .expect(200);
    expect(res.body.lateFeeFils).toBe(250);
    expect(res.body.totalFils).toBe(2250);
  });
});
