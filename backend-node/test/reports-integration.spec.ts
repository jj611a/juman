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
import { ITEM_LIFECYCLE } from '../src/inventory/inventory.constants';

describe('Reports integration (Phase 7.0)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';
  let customerId = '';
  let itemId = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-reports-');
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
      .send({ fullName: 'Reports Customer', phone: '07901112233' })
      .expect(201);
    customerId = customer.body.id;

    const item = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Reports dress',
        status: 'active',
        rentalPrice: 8000,
        generateBarcode: true,
      })
      .expect(201);
    itemId = item.body.id;

    const rental = await request(app.getHttpServer())
      .post('/rentals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        rentalDate: new Date().toISOString(),
        expectedReturnDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        items: [{ itemId, agreedRentalPrice: 8000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rentals/${rental.body.id}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ depositAmountFils: 1000 })
      .expect(200);
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

  it('serves dashboard and financial aggregates', async () => {
    await request(app.getHttpServer()).get('/reports/dashboard').expect(401);

    const dash = await request(app.getHttpServer())
      .get('/reports/dashboard')
      .set(auth())
      .expect(200);
    expect(dash.body.activeRentals).toBeGreaterThanOrEqual(1);
    expect(dash.body.inventoryCount).toBeGreaterThanOrEqual(1);
    expect(dash.body.availableItems + dash.body.reservedItems).toBeLessThanOrEqual(
      dash.body.inventoryCount + 5,
    );

    const fin = await request(app.getHttpServer())
      .get('/reports/financial')
      .set(auth())
      .expect(200);
    expect(fin.body.openSettlementsCount).toBeGreaterThanOrEqual(1);
    expect(fin.body.outstandingFils).toBeGreaterThanOrEqual(0);
  });

  it('serves rental inventory and customer report endpoints', async () => {
    const current = await request(app.getHttpServer())
      .get('/reports/rentals/current')
      .set(auth())
      .expect(200);
    expect(current.body.meta.total).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get('/reports/rentals/overdue')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/rentals/returns')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/rentals/history')
      .query({ customerId })
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/rentals/reservations')
      .set(auth())
      .expect(200);

    const value = await request(app.getHttpServer())
      .get('/reports/inventory/value')
      .set(auth())
      .expect(200);
    expect(value.body.itemCount).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get('/reports/inventory/availability')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/inventory/category')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/inventory/brand')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/inventory/color')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/inventory/size')
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get('/reports/inventory/lifecycle')
      .set(auth())
      .expect(200);

    await prisma.item.update({
      where: { id: itemId },
      data: { lifecycleState: ITEM_LIFECYCLE.MAINTENANCE },
    });
    // restore for cleanup neutrality — maintenance list still readable
    await request(app.getHttpServer())
      .get('/reports/inventory/maintenance')
      .set(auth())
      .expect(200);
    await prisma.item.update({
      where: { id: itemId },
      data: { lifecycleState: ITEM_LIFECYCLE.RENTED },
    });

    await request(app.getHttpServer())
      .get('/reports/inventory/retired')
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .get(`/reports/customers/${customerId}/rentals`)
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/reports/customers/${customerId}/outstanding`)
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/reports/customers/${customerId}/payments`)
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/reports/customers/${customerId}/reservations`)
      .set(auth())
      .expect(200);
  });

  it('exports CSV and JSON; rejects PDF stub', async () => {
    const csv = await request(app.getHttpServer())
      .get('/reports/export')
      .query({ report: 'dashboard', format: 'csv' })
      .set(auth())
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(String(csv.text)).toContain('activeRentals');

    const json = await request(app.getHttpServer())
      .get('/reports/export')
      .query({ report: 'financial', format: 'json' })
      .set(auth())
      .expect(200);
    expect(json.headers['content-type']).toContain('application/json');

    await request(app.getHttpServer())
      .get('/reports/export')
      .query({ report: 'dashboard', format: 'pdf' })
      .set(auth())
      .expect(400);
  });
});
