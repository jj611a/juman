import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';

describe('Customers integration', () => {
  let app: INestApplication;
  let dataDir: string;
  let token = '';
  let customerId = '';
  let customerNumber = '';

  beforeAll(async () => {
    const prepared = prepareTestDatabase('juman-cust-');
    dataDir = prepared.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Juman!Bootstrap1' })
      .expect(200);
    token = login.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Juman!Bootstrap1', newPassword: 'NewStrong!Pass1' })
      .expect(200);

    const again = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1' })
      .expect(200);
    token = again.body.accessToken;
  }, 180_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('requires auth and permission', async () => {
    await request(app.getHttpServer()).get('/customers').expect(401);
  });

  it('creates customer and rejects duplicate active phone', async () => {
    const created = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'سارة أحمد',
        phone: '07701112233',
        secondaryPhone: '07801112233',
        address: 'الكرادة',
        city: 'بغداد',
        nationalId: '12345678',
        gender: 'FEMALE',
        notes: 'عميلة تجريبية',
      })
      .expect(201);

    expect(created.body.customerNumber).toMatch(/^CUS-\d{8}$/);
    expect(created.body.phoneNormalized).toBe('9647701112233');
    customerId = created.body.id;
    customerNumber = created.body.customerNumber;

    await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'أخرى', phone: '07701112233' })
      .expect(409);
  });

  it('gets by id and number; lists and searches', async () => {
    const byId = await request(app.getHttpServer())
      .get(`/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(byId.body.fullName).toBe('سارة أحمد');

    await request(app.getHttpServer())
      .get(`/customers/number/${customerNumber}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/customers')
      .query({ city: 'بغداد', status: 'active', sortBy: 'fullName', sortDir: 'asc' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const search = await request(app.getHttpServer())
      .get('/customers/search')
      .query({ q: '7701112233' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(search.body.items.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get('/customers/search')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('updates validates soft-deletes and restores', async () => {
    await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'سارة محدث', status: 'inactive', clearBirthDate: true })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nationalId: 'abcd' })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const deletedList = await request(app.getHttpServer())
      .get('/customers')
      .query({ deleted: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deletedList.body.items.some((c: { id: string }) => c.id === customerId)).toBe(true);

    const liveList = await request(app.getHttpServer())
      .get('/customers')
      .query({ deleted: 'false' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(liveList.body.items.some((c: { id: string }) => c.id === customerId)).toBe(false);

    // phone freed for a new active customer
    await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'جديدة', phone: '07701112233' })
      .expect(201);

    // restore original conflicts on phone
    await request(app.getHttpServer())
      .post(`/customers/${customerId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});