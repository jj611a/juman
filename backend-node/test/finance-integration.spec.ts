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

describe('Finance core integration (Phase 6.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemId = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-finance-');
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
      .send({ fullName: 'Finance Customer', phone: '07909998877' })
      .expect(201);
    customerId = customer.body.id;

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Finance dress',
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

  it('rental checkout creates charge+deposit; payments reduce outstanding', async () => {
    await request(app.getHttpServer()).get('/finance/accounts').expect(401);

    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        items: [{ itemId, agreedRentalPrice: 5000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set(auth())
      .send({ depositAmountFils: 1000 })
      .expect(200);

    const accounts = await request(app.getHttpServer())
      .get('/finance/accounts')
      .query({ customerId })
      .set(auth())
      .expect(200);
    expect(accounts.body.meta.total).toBeGreaterThanOrEqual(1);
    const accountId = accounts.body.items[0].id;

    const outstandingAfterCharge = await request(app.getHttpServer())
      .get('/finance/outstanding')
      .query({ accountId })
      .set(auth())
      .expect(200);
    // 5000 charge - 1000 deposit = 4000
    expect(outstandingAfterCharge.body.outstandingFils).toBe(4000);

    const payment = await request(app.getHttpServer())
      .post('/finance/payments')
      .set(auth())
      .send({ accountId, amountFils: 1500, method: 'cash' })
      .expect(201);

    expect(payment.body.status).toBe('completed');
    expect(payment.body.paymentNumber).toMatch(/^PAY-\d{8}$/);

    const afterPay = await request(app.getHttpServer())
      .get('/finance/outstanding')
      .query({ customerId })
      .set(auth())
      .expect(200);
    expect(afterPay.body.outstandingFils).toBe(2500);

    const txs = await request(app.getHttpServer())
      .get('/finance/transactions')
      .query({ accountId })
      .set(auth())
      .expect(200);
    expect(txs.body.meta.total).toBeGreaterThanOrEqual(3);

    const pays = await request(app.getHttpServer())
      .get('/finance/payments')
      .query({ accountId })
      .set(auth())
      .expect(200);
    expect(pays.body.meta.total).toBeGreaterThanOrEqual(1);

    const audits = await prisma.financialAudit.count();
    expect(audits).toBeGreaterThanOrEqual(3);
  });

  it('supports concurrent payments without losing balance integrity', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set(auth())
      .send({
        displayName: 'Concurrent finance dress',
        status: 'active',
        rentalPrice: 10000,
        generateBarcode: true,
      })
      .expect(201);

    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000 * 32).toISOString(),
        items: [{ itemId: item.body.id, agreedRentalPrice: 10000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set(auth())
      .send({})
      .expect(200);

    const accounts = await request(app.getHttpServer())
      .get('/finance/accounts')
      .query({ customerId })
      .set(auth())
      .expect(200);
    const accountId = accounts.body.items[0].id;

    const before = (
      await request(app.getHttpServer())
        .get('/finance/outstanding')
        .query({ accountId })
        .set(auth())
    ).body.outstandingFils as number;

    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/finance/payments')
        .set(auth())
        .send({ accountId, amountFils: 1000 }),
      request(app.getHttpServer())
        .post('/finance/payments')
        .set(auth())
        .send({ accountId, amountFils: 1000 }),
    ]);
    expect(results.every((r) => r.status === 201)).toBe(true);

    const after = (
      await request(app.getHttpServer())
        .get('/finance/outstanding')
        .query({ accountId })
        .set(auth())
    ).body.outstandingFils as number;
    expect(after).toBe(before - 2000);
  });

  it('rolls back payment when account is closed', async () => {
    const account = await prisma.financialAccount.findFirst({
      where: { customerId, deletedAt: null },
    });
    expect(account).toBeTruthy();
    await prisma.financialAccount.update({
      where: { id: account!.id },
      data: { status: 'closed' },
    });

    const beforeMoves = await prisma.moneyMovement.count({
      where: { accountId: account!.id },
    });

    await request(app.getHttpServer())
      .post('/finance/payments')
      .set(auth())
      .send({ accountId: account!.id, amountFils: 100 })
      .expect(409);

    const afterMoves = await prisma.moneyMovement.count({
      where: { accountId: account!.id },
    });
    expect(afterMoves).toBe(beforeMoves);

    await prisma.financialAccount.update({
      where: { id: account!.id },
      data: { status: 'open' },
    });
  });
});
