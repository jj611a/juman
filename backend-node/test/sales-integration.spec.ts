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
import { WALK_IN_CUSTOMER_NUMBER } from '../src/customers/customers.constants';
import { FINANCIAL_TX_TYPE } from '../src/finance/finance.constants';

describe('Sales domain integration (Phase 6.7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemA = '';
  let itemB = '';
  let barcodeA = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-sales-');
    dir = p.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    process.env.JUMAN_SEED_DEMO = '0';
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
      .send({ fullName: 'Sale Customer', phone: '07901112233' })
      .expect(201);
    customerId = customer.body.id;

    const a = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Sale dress A',
        status: 'active',
        salePrice: 150_000,
        generateBarcode: true,
      })
      .expect(201);
    itemA = a.body.id;
    barcodeA = a.body.barcodes?.[0]?.value ?? a.body.barcodes?.[0]?.code;

    const b = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Sale dress B',
        status: 'active',
        salePrice: 200_000,
        generateBarcode: true,
      })
      .expect(201);
    itemB = b.body.id;
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
    await request(app.getHttpServer()).get('/sales').expect(401);
  });

  it('seeds Walk-in customer with financial account', async () => {
    const walkIn = await prisma.customer.findUnique({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    expect(walkIn).toBeTruthy();
    expect(walkIn!.deletedAt).toBeNull();
    const account = await prisma.financialAccount.findFirst({
      where: { customerId: walkIn!.id, deletedAt: null },
    });
    expect(account).toBeTruthy();
  });

  it('creates anonymous draft, confirms (settlement+charge+hold), pays, completes to sold', async () => {
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ itemId: itemA, priceFils: 150_000 }],
        notes: 'walk-in sale',
      })
      .expect(201);

    expect(draft.body.saleNumber).toMatch(/^SALE-\d{8}$/);
    expect(draft.body.status).toBe('draft');
    expect(draft.body.customerId).toBeNull();
    expect(draft.body.totalFils).toBe(150_000);
    expect(draft.body.items[0].barcodeSnapshot).toBeTruthy();

    const barcodeBefore = await prisma.barcode.findFirst({
      where: { code: barcodeA },
    });
    expect(barcodeBefore?.status).toBe('activated');

    const confirmed = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `sale-confirm-${draft.body.id}` })
      .expect(200);

    expect(confirmed.body.status).toBe('confirmed');
    expect(confirmed.body.settlement).toBeTruthy();

    const itemHeld = await prisma.item.findUniqueOrThrow({ where: { id: itemA } });
    expect(itemHeld.lifecycleState).toBe('for_sale');

    const settlement = await prisma.rentalSettlement.findFirst({
      where: { saleId: draft.body.id, deletedAt: null },
    });
    expect(settlement).toBeTruthy();
    expect(settlement!.entityType).toBe('sale');
    expect(settlement!.entityId).toBe(draft.body.id);
    expect(settlement!.chargeFils).toBe(150_000);

    const walkIn = await prisma.customer.findUniqueOrThrow({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    expect(settlement!.customerId).toBe(walkIn.id);

    const charge = await prisma.financialTransaction.findFirst({
      where: {
        type: FINANCIAL_TX_TYPE.SALE_CHARGE,
        referenceType: 'sale',
        referenceId: draft.body.id,
        status: 'posted',
      },
    });
    expect(charge).toBeTruthy();
    expect(charge!.amountFils).toBe(150_000);

    const paid = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountFils: 150_000, method: 'cash' })
      .expect(200);
    expect(paid.body.settlement.remainingFils).toBe(0);

    const salePayment = await prisma.financialTransaction.findFirst({
      where: {
        type: FINANCIAL_TX_TYPE.SALE_PAYMENT,
        settlementId: settlement!.id,
        status: 'posted',
      },
    });
    expect(salePayment).toBeTruthy();

    const completed = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: `sale-complete-${draft.body.id}` })
      .expect(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.completedAt).toBeTruthy();

    const itemSold = await prisma.item.findUniqueOrThrow({ where: { id: itemA } });
    expect(itemSold.lifecycleState).toBe('sold');

    const barcodeAfter = await prisma.barcode.findFirst({
      where: { code: barcodeA },
    });
    expect(barcodeAfter?.status).toBe('activated');
    expect(barcodeAfter?.entityId).toBe(barcodeBefore?.entityId);

    const history = await request(app.getHttpServer())
      .get(`/sales/${draft.body.id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.some((h: { action: string }) => h.action === 'completed')).toBe(
      true,
    );

    // Cannot cancel completed
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'nope' })
      .expect(409);
  });

  it('reassigns Walk-in settlement to real customer before complete', async () => {
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: itemB, priceFils: 200_000 }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const before = await prisma.rentalSettlement.findFirstOrThrow({
      where: { saleId: draft.body.id },
    });
    const walkIn = await prisma.customer.findUniqueOrThrow({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    expect(before.customerId).toBe(walkIn.id);

    const completed = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, paymentAmountFils: 200_000 })
      .expect(200);

    expect(completed.body.customerId).toBe(customerId);
    expect(completed.body.status).toBe('completed');

    const after = await prisma.rentalSettlement.findFirstOrThrow({
      where: { saleId: draft.body.id },
    });
    expect(after.customerId).toBe(customerId);
    expect(after.accountId).not.toBe(before.accountId);
  });

  it('cancels confirmed unpaid sale: voids ledger, restores inventory', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Cancel sale dress',
        status: 'active',
        salePrice: 90_000,
        generateBarcode: true,
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [{ itemId: item.body.id, priceFils: 90_000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'customer changed mind' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');

    const itemRow = await prisma.item.findUniqueOrThrow({
      where: { id: item.body.id },
    });
    expect(itemRow.lifecycleState).toBe('available');

    const settlement = await prisma.rentalSettlement.findFirstOrThrow({
      where: { saleId: draft.body.id },
    });
    expect(settlement.status).toBe('cancelled');

    const charge = await prisma.financialTransaction.findFirst({
      where: {
        type: FINANCIAL_TX_TYPE.SALE_CHARGE,
        referenceId: draft.body.id,
      },
    });
    expect(charge?.status).toBe('voided');
  });

  it('rejects selling non-sellable lifecycle and duplicate confirm is idempotent', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Rented-like dress',
        status: 'active',
        salePrice: 10_000,
        generateBarcode: true,
      })
      .expect(201);

    await prisma.item.update({
      where: { id: item.body.id },
      data: { lifecycleState: 'rented' },
    });

    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: item.body.id }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);

    // Fresh sellable item for idempotency
    const ok = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Idempotent sale dress',
        status: 'active',
        salePrice: 11_000,
        generateBarcode: true,
      })
      .expect(201);

    const d2 = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: ok.body.id }] })
      .expect(201);

    const key = `idem-confirm-${d2.body.id}`;
    const c1 = await request(app.getHttpServer())
      .post(`/sales/${d2.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: key })
      .expect(200);
    const c2 = await request(app.getHttpServer())
      .post(`/sales/${d2.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: key })
      .expect(200);
    expect(c2.body.id).toBe(c1.body.id);
    expect(c2.body.status).toBe('confirmed');

    const settlements = await prisma.rentalSettlement.count({
      where: { saleId: d2.body.id },
    });
    expect(settlements).toBe(1);
  });

  it('concurrent confirm yields single settlement', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Concurrent sale dress',
        status: 'active',
        salePrice: 12_000,
        generateBarcode: true,
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: item.body.id }] })
      .expect(201);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idempotencyKey: `c1-${draft.body.id}` }),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idempotencyKey: `c2-${draft.body.id}` }),
    ]);

    const oks = results.filter((r) => r.status === 200);
    expect(oks.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.rentalSettlement.count({ where: { saleId: draft.body.id } }),
    ).toBe(1);
  });

  it('lists sales and cancels draft without settlement', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Draft cancel dress',
        status: 'active',
        salePrice: 5_000,
        generateBarcode: true,
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: item.body.id }] })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.items.some((s: { id: string }) => s.id === draft.body.id)).toBe(
      true,
    );

    const one = await request(app.getHttpServer())
      .get(`/sales/${draft.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(one.body.status).toBe('draft');

    const cancelled = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'draft abort' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');

    const itemRow = await prisma.item.findUniqueOrThrow({
      where: { id: item.body.id },
    });
    expect(itemRow.lifecycleState).toBe('available');
  });

  it('blocks cancel after payment without refund', async () => {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Paid cancel block',
        status: 'active',
        salePrice: 50_000,
        generateBarcode: true,
      })
      .expect(201);

    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId: item.body.id }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountFils: 50_000 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);
  });
});
