import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';
import { PrismaService } from '../src/database/prisma.service';
import { WALK_IN_CUSTOMER_NUMBER } from '../src/customers/customers.constants';
import { CustomersService } from '../src/customers/customers.service';
import { FINANCIAL_TX_TYPE } from '../src/finance/finance.constants';
import { SalesService } from '../src/sales/sales.service';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Check = {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  detail?: string;
};

describe('Phase 6.7.1 Sales integrity certification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sales: SalesService;
  let customers: CustomersService;
  let dir = '';
  let token = '';
  let customerId = '';
  const checks: Check[] = [];

  function record(id: string, name: string, ok: boolean, detail?: string) {
    checks.push({ id, name, status: ok ? 'PASS' : 'FAIL', detail });
    expect(ok, detail ?? name).toBe(true);
  }

  async function createSellableItem(name: string, price = 10_000) {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: name,
        status: 'active',
        salePrice: price,
        generateBarcode: true,
      })
      .expect(201);
    return item.body.id as string;
  }

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-sales-671-');
    dir = p.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    process.env.JUMAN_SEED_DEMO = '0';
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    sales = app.get(SalesService);
    customers = app.get(CustomersService);

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
      .send({ fullName: 'Cert Customer', phone: '07909998877' })
      .expect(201);
    customerId = customer.body.id;
  }, 180_000);

  afterAll(async () => {
    const out = {
      phase: '6.7.1',
      generatedAt: new Date().toISOString(),
      checks,
      summary: {
        total: checks.length,
        pass: checks.filter((c) => c.status === 'PASS').length,
        fail: checks.filter((c) => c.status === 'FAIL').length,
      },
    };
    try {
      writeFileSync(
        join(__dirname, '../../docs/backend-v2/cert_sales_671.json'),
        JSON.stringify(out, null, 2),
        'utf8',
      );
    } catch {
      /* ignore write errors in temp runners */
    }
    if (app) await app.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('RBAC: anonymous 401 on all sales endpoints', async () => {
    const itemId = await createSellableItem('rbac-item');
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);

    const anon = [
      request(app.getHttpServer()).get('/sales'),
      request(app.getHttpServer()).get(`/sales/${draft.body.id}`),
      request(app.getHttpServer()).get(`/sales/${draft.body.id}/history`),
      request(app.getHttpServer()).post('/sales').send({ items: [{ itemId }] }),
      request(app.getHttpServer()).post(`/sales/${draft.body.id}/confirm`).send({}),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/payment`)
        .send({ amountFils: 1 }),
      request(app.getHttpServer()).post(`/sales/${draft.body.id}/complete`).send({}),
      request(app.getHttpServer()).post(`/sales/${draft.body.id}/cancel`).send({}),
    ];
    const results = await Promise.all(anon);
    const all401 = results.every((r) => r.status === 401);
    record('rbac.anon', 'Anonymous requests return 401', all401);
  });

  it('RBAC: wrong role 403; admin allowed', async () => {
    const inventoryRole = await prisma.role.findFirstOrThrow({
      where: { name: 'Inventory' },
    });
    const users = app.get((await import('../src/users/users.service')).UsersService);
    await users.createUser({
      username: 'inv_sales_deny',
      password: 'InvDeny!Pass1',
      fullName: 'Inventory No Sales',
      roleId: inventoryRole.id,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'inv_sales_deny', password: 'InvDeny!Pass1' });
    const invToken = login.body.accessToken as string;

    const itemId = await createSellableItem('rbac-403');
    const denied = await Promise.all([
      request(app.getHttpServer()).get('/sales').set('Authorization', `Bearer ${invToken}`),
      request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${invToken}`)
        .send({ items: [{ itemId }] }),
    ]);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    const deniedMutations = await Promise.all([
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/confirm`)
        .set('Authorization', `Bearer ${invToken}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/payment`)
        .set('Authorization', `Bearer ${invToken}`)
        .send({ amountFils: 1 }),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/complete`)
        .set('Authorization', `Bearer ${invToken}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/cancel`)
        .set('Authorization', `Bearer ${invToken}`)
        .send({}),
      request(app.getHttpServer())
        .get(`/sales/${draft.body.id}`)
        .set('Authorization', `Bearer ${invToken}`),
      request(app.getHttpServer())
        .get(`/sales/${draft.body.id}/history`)
        .set('Authorization', `Bearer ${invToken}`),
    ]);
    const all403 = [...denied, ...deniedMutations].every((r) => r.status === 403);
    const okList = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${token}`);
    record(
      'rbac.forbidden',
      'Inventory role gets 403 on sales; admin gets 200',
      all403 && okList.status === 200,
      `denied=${[...denied, ...deniedMutations].map((r) => r.status).join(',')} admin=${okList.status}`,
    );
  });

  it('rejects foreign for_sale hold (two sales same item)', async () => {
    const itemId = await createSellableItem('hold-steal', 20_000);
    const a = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${a.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const steal = await request(app.getHttpServer())
      .post(`/sales/${b.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    record(
      'hold.steal',
      'Second confirm on held item returns 409',
      steal.status === 409,
      `status=${steal.status}`,
    );
  });

  it('concurrent confirm: one settlement only', async () => {
    const itemId = await createSellableItem('concurrent-item', 15_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idempotencyKey: `c-a-${draft.body.id}` }),
      request(app.getHttpServer())
        .post(`/sales/${draft.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idempotencyKey: `c-b-${draft.body.id}` }),
    ]);
    const oks = results.filter((r) => r.status === 200).length;
    const settlements = await prisma.rentalSettlement.count({
      where: { saleId: draft.body.id },
    });
    record(
      'concurrency.confirm',
      'Concurrent confirm yields ≥1 success and exactly 1 settlement',
      oks >= 1 && settlements === 1,
      `oks=${oks} settlements=${settlements}`,
    );
  });

  it('settlement cancel blocked while sale live; complete rejects cancelled settlement', async () => {
    const itemId = await createSellableItem('stl-cancel', 12_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const st = await prisma.rentalSettlement.findFirstOrThrow({
      where: { saleId: draft.body.id },
    });
    const cancelSt = await request(app.getHttpServer())
      .post(`/settlements/${st.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    record(
      'settlement.cancel.blocked',
      'HTTP settlement cancel blocked for live sale',
      cancelSt.status === 409,
      `status=${cancelSt.status}`,
    );

    // Force-cancel settlement in DB to simulate orphan path, then complete must 409
    await prisma.rentalSettlement.update({
      where: { id: st.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    const complete = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    record(
      'complete.cancelled.settlement',
      'Complete rejects cancelled settlement',
      complete.status === 409,
      `status=${complete.status}`,
    );
  });

  it('rejects customer reassignment after payment', async () => {
    const itemId = await createSellableItem('reassign-paid', 30_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountFils: 30_000 })
      .expect(200);

    const complete = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId });
    record(
      'reassign.after.pay',
      'Complete with customer after payment returns 409',
      complete.status === 409,
      `status=${complete.status} body=${JSON.stringify(complete.body).slice(0, 120)}`,
    );
  });

  it('lifecycle: sold cannot return to available/rented; sale status irreversible', async () => {
    const itemId = await createSellableItem('sold-term', 8_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentAmountFils: 8_000 })
      .expect(200);

    const toAvail = await request(app.getHttpServer())
      .post(`/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'available' });
    const toRented = await request(app.getHttpServer())
      .post(`/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'rented' });
    record(
      'lifecycle.sold.terminal',
      'sold→available and sold→rented rejected',
      toAvail.status === 409 && toRented.status === 409,
    );

    const cancelDone = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    record(
      'sale.completed.irreversible',
      'Cannot cancel completed sale',
      cancelDone.status === 409,
    );
  });

  it('Walk-in: many anonymous sales share single customer+account', async () => {
    const n = 100;
    const itemIds: string[] = [];
    for (let i = 0; i < n; i++) {
      const row = await prisma.item.create({
        data: {
          internalCode: `WALK-CERT-${Date.now()}-${i}`,
          displayName: `walkin-${i}`,
          status: 'active',
          lifecycleState: 'available',
          salePrice: 1000 + i,
        },
      });
      itemIds.push(row.id);
    }
    for (const itemId of itemIds) {
      const d = await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ itemId }] })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/sales/${d.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);
    }
    await Promise.all(
      Array.from({ length: 20 }, () => customers.ensureWalkInCustomer()),
    );
    const walkIns = await prisma.customer.count({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    const walkIn = await prisma.customer.findUniqueOrThrow({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    const accounts = await prisma.financialAccount.count({
      where: { customerId: walkIn.id, deletedAt: null },
    });
    const settlementsOnWalkIn = await prisma.rentalSettlement.count({
      where: { customerId: walkIn.id, entityType: 'sale', deletedAt: null },
    });
    record(
      'walkin.unique',
      'Single WALK-IN customer and account after 100 anonymous confirms',
      walkIns === 1 && accounts === 1 && settlementsOnWalkIn >= n,
      `customers=${walkIns} accounts=${accounts} saleSettlements=${settlementsOnWalkIn}`,
    );
  }, 300_000);

  it('soft-delete blocked for confirmed/completed; allowed for cancelled draft', async () => {
    const itemId = await createSellableItem('softdel', 5_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    let blocked = false;
    try {
      await sales.softDelete(draft.body.id);
    } catch {
      blocked = true;
    }
    record('softdelete.confirmed', 'softDelete rejects confirmed sale', blocked);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    const deleted = await sales.softDelete(draft.body.id);
    record('softdelete.cancelled', 'softDelete allows cancelled sale', deleted.deleted === true);
  });

  it('API validation: bad UUID, bad payload, idempotent confirm replay', async () => {
    const badUuid = await request(app.getHttpServer())
      .get('/sales/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    record('api.bad.uuid', 'Bad UUID rejected', badUuid.status === 400);

    const badPayload = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    record('api.bad.payload', 'Empty items rejected', badPayload.status === 400);

    const itemId = await createSellableItem('idem', 7_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);
    const key = `idem-${draft.body.id}`;
    const c1 = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: key })
      .expect(200);
    const c2 = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: key })
      .expect(200);
    record(
      'api.idempotency',
      'Confirm idempotency replay matches',
      c1.body.id === c2.body.id && c2.body.status === 'confirmed',
    );
  });

  it('full money path: charge payment outstanding cancel unpaid', async () => {
    const itemId = await createSellableItem('money-path', 40_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId, priceFils: 40_000 }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    const st = await prisma.rentalSettlement.findFirstOrThrow({
      where: { saleId: draft.body.id },
    });
    record(
      'money.charge',
      'Settlement charge equals sale total',
      st.chargeFils === 40_000 && st.remainingFils === 40_000,
    );
    const charge = await prisma.financialTransaction.findFirst({
      where: {
        type: FINANCIAL_TX_TYPE.SALE_CHARGE,
        referenceId: draft.body.id,
        status: 'posted',
      },
    });
    record('money.ledger', 'sale_charge posted', !!charge && charge.amountFils === 40_000);

    await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    const voided = await prisma.financialTransaction.findFirst({
      where: { type: FINANCIAL_TX_TYPE.SALE_CHARGE, referenceId: draft.body.id },
    });
    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    record(
      'money.cancel.rollback',
      'Cancel voids charge and restores available',
      voided?.status === 'voided' && item.lifecycleState === 'available',
    );
  });

  it('forced rollback: failure after charge leaves no orphans', async () => {
    const { FinanceService } = await import('../src/finance/finance.service');
    const finance = app.get(FinanceService);
    const itemId = await createSellableItem('rollback', 9_000);
    const draft = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ itemId }] })
      .expect(201);

    const orig = finance.createChargeInTx.bind(finance);
    const spy = vi
      .spyOn(finance, 'createChargeInTx')
      .mockImplementation(async (...args: Parameters<typeof orig>) => {
        await orig(...args);
        throw new Error('forced failure after ledger post');
      });

    const confirm = await request(app.getHttpServer())
      .post(`/sales/${draft.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    spy.mockRestore();

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: draft.body.id } });
    const st = await prisma.rentalSettlement.findFirst({
      where: { saleId: draft.body.id },
    });
    const charges = await prisma.financialTransaction.count({
      where: {
        referenceId: draft.body.id,
        type: FINANCIAL_TX_TYPE.SALE_CHARGE,
      },
    });
    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    record(
      'rollback.integrity',
      'Mid-TX failure after charge rolls back sale/settlement/ledger/hold',
      confirm.status >= 400 &&
        sale.status === 'draft' &&
        !st &&
        charges === 0 &&
        item.lifecycleState === 'available',
      `http=${confirm.status} sale=${sale.status} st=${st?.id ?? 'none'} charges=${charges} life=${item.lifecycleState}`,
    );
  });

  it('public lifecycle cannot available→sold', async () => {
    const itemId = await createSellableItem('no-direct-sold', 3_000);
    const r = await request(app.getHttpServer())
      .post(`/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'sold' });
    record(
      'lifecycle.no.direct.sold',
      'available→sold rejected on public transition',
      r.status === 409,
      `status=${r.status}`,
    );
  });
});
