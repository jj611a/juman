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

/**
 * Phase 5.4 integrity regression: availability symmetry, concurrent allocation, rollback.
 */
describe('Rental integrity remediation (Phase 5.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-rental-integrity-');
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
      .send({ fullName: 'Integrity Customer', phone: '07901112233' })
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

  async function createItem(name: string) {
    const item = await request(app.getHttpServer())
      .post('/items')
      .set(auth())
      .send({
        displayName: name,
        status: 'active',
        rentalPrice: 1500,
        generateBarcode: true,
      })
      .expect(201);
    return item.body as { id: string };
  }

  function window(daysFromNow: number, lengthDays: number) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + daysFromNow);
    start.setUTCHours(0, 0, 0, 0);
    const checkout = new Date(start);
    const ret = new Date(start);
    ret.setUTCDate(ret.getUTCDate() + lengthDays);
    return {
      startDate: start.toISOString(),
      expectedCheckoutDate: checkout.toISOString(),
      expectedReturnDate: ret.toISOString(),
      rentalDate: start.toISOString(),
    };
  }

  it('blocks walk-in rental create overlapping a confirmed reservation', async () => {
    const item = await createItem('Symmetry dress');
    const w = window(100, 5);

    await request(app.getHttpServer())
      .post('/reservations')
      .set(auth())
      .send({
        customerId,
        startDate: w.startDate,
        expectedCheckoutDate: w.expectedCheckoutDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: w.rentalDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(409);
  });

  it('blocks reservation create overlapping a walk-in draft rental', async () => {
    const item = await createItem('Symmetry reverse');
    const w = window(120, 4);

    await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: w.rentalDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/reservations')
      .set(auth())
      .send({
        customerId,
        startDate: w.startDate,
        expectedCheckoutDate: w.expectedCheckoutDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(409);
  });

  it('allows exactly one of two concurrent overlapping reservation creates', async () => {
    const item = await createItem('Concurrent RSV');
    const w = window(140, 3);
    const payload = {
      customerId,
      startDate: w.startDate,
      expectedCheckoutDate: w.expectedCheckoutDate,
      expectedReturnDate: w.expectedReturnDate,
      items: [{ itemId: item.id }],
    };

    const results = await Promise.all([
      request(app.getHttpServer()).post('/reservations').set(auth()).send(payload),
      request(app.getHttpServer()).post('/reservations').set(auth()).send(payload),
    ]);

    const oks = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    expect(oks).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const count = await prisma.reservation.count({
      where: {
        deletedAt: null,
        status: 'confirmed',
        items: { some: { itemId: item.id } },
      },
    });
    expect(count).toBe(1);
  });

  it('allows exactly one of two concurrent walk-in rental creates on same window', async () => {
    const item = await createItem('Concurrent rental');
    const w = window(160, 3);
    const payload = {
      customerId,
      rentalDate: w.rentalDate,
      expectedReturnDate: w.expectedReturnDate,
      items: [{ itemId: item.id }],
    };

    const results = await Promise.all([
      request(app.getHttpServer()).post('/rentals').set(auth()).send(payload),
      request(app.getHttpServer()).post('/rentals').set(auth()).send(payload),
    ]);

    const oks = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    expect(oks).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });

  it('walk-in checkout and reservation checkout both use availability + lifecycle', async () => {
    const walkItem = await createItem('Walk-in checkout');
    const rsvItem = await createItem('Reservation checkout');
    const w = window(180, 2);

    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: w.rentalDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: walkItem.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set(auth())
      .send({ reason: 'integrity' })
      .expect(200);

    const walkState = await prisma.item.findUniqueOrThrow({
      where: { id: walkItem.id },
    });
    expect(walkState.lifecycleState).toBe('rented');

    const rsv = await request(app.getHttpServer())
      .post('/reservations')
      .set(auth())
      .send({
        customerId,
        startDate: w.startDate,
        expectedCheckoutDate: w.expectedCheckoutDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: rsvItem.id }],
      })
      .expect(201);

    const checked = await request(app.getHttpServer())
      .post(`/reservations/${rsv.body.id}/checkout`)
      .set(auth())
      .send({})
      .expect(200);
    expect(checked.body.rental?.id).toBeTruthy();

    const rsvState = await prisma.item.findUniqueOrThrow({
      where: { id: rsvItem.id },
    });
    expect(rsvState.lifecycleState).toBe('rented');
  });

  it('rolls back reservation create when availability fails mid-path', async () => {
    const item = await createItem('Rollback item');
    const w = window(200, 2);

    await request(app.getHttpServer())
      .post('/reservations')
      .set(auth())
      .send({
        customerId,
        startDate: w.startDate,
        expectedCheckoutDate: w.expectedCheckoutDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(201);

    const before = await prisma.reservation.count({
      where: { items: { some: { itemId: item.id } } },
    });

    await request(app.getHttpServer())
      .post('/reservations')
      .set(auth())
      .send({
        customerId,
        startDate: w.startDate,
        expectedCheckoutDate: w.expectedCheckoutDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(409);

    const after = await prisma.reservation.count({
      where: { items: { some: { itemId: item.id } } },
    });
    expect(after).toBe(before);
  });

  it('rejects concurrent checkout of the same draft rental (one wins)', async () => {
    const item = await createItem('Concurrent checkout');
    const w = window(220, 2);
    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set(auth())
      .send({
        customerId,
        rentalDate: w.rentalDate,
        expectedReturnDate: w.expectedReturnDate,
        items: [{ itemId: item.id }],
      })
      .expect(201);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/rentals/${rental.body.id}/checkout`)
        .set(auth())
        .send({}),
      request(app.getHttpServer())
        .post(`/rentals/${rental.body.id}/checkout`)
        .set(auth())
        .send({}),
    ]);

    const oks = results.filter((r) => r.status === 200);
    expect(oks.length).toBeGreaterThanOrEqual(1);
    // Idempotent replay may also return 200 — money/inventory must stay single-winner.
    const itemRow = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemRow.lifecycleState).toBe('rented');
    expect(
      await prisma.rentalSettlement.count({
        where: { rentalId: rental.body.id, deletedAt: null },
      }),
    ).toBe(1);
  });
});
