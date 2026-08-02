import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';
import { BarcodeService } from '../src/barcode/barcode.service';

describe('Barcode integration', () => {
  let app: INestApplication;
  let dataDir: string;
  let token = '';
  let value = '';

  beforeAll(async () => {
    const prepared = prepareTestDatabase('juman-bc-');
    dataDir = prepared.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/barcodes').expect(401);
  });

  it('generates validates lists and lifecycle', async () => {
    const generated = await request(app.getHttpServer())
      .post('/barcodes/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'code128' })
      .expect(201);
    expect(generated.body.value).toMatch(/^DR-\d{8}$/);
    expect(generated.body.status).toBe('reserved');
    value = generated.body.value;

    await request(app.getHttpServer())
      .post('/barcodes/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ value, type: 'code128' })
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });

    // explicit reserve of a fresh value
    const reserved = await request(app.getHttpServer())
      .post('/barcodes/reserve')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'DR-MANUAL01', type: 'code128' })
      .expect(201);
    expect(reserved.body.value).toBe('DR-MANUAL01');

    // duplicate reserve rejected
    await request(app.getHttpServer())
      .post('/barcodes/reserve')
      .set('Authorization', `Bearer ${token}`)
      .send({ value })
      .expect(409);

    const list = await request(app.getHttpServer())
      .get('/barcodes')
      .query({ q: 'DR', status: 'reserved' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get(`/barcodes/${generated.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // activate via service (no inventory HTTP)
    const barcodes = app.get(BarcodeService);
    await barcodes.activate(value, 'dress', 'dress-1');

    await request(app.getHttpServer())
      .post('/barcodes/release')
      .set('Authorization', `Bearer ${token}`)
      .send({ value })
      .expect(200);

    await request(app.getHttpServer())
      .post('/barcodes/retire')
      .set('Authorization', `Bearer ${token}`)
      .send({ value })
      .expect(200);
  });

  it('handles concurrent reservation uniqueness', async () => {
    const barcodes = app.get(BarcodeService);
    const results = await Promise.all([
      barcodes.generate({}, { userId: 'u1' } as never),
      barcodes.generate({}, { userId: 'u1' } as never),
      barcodes.generate({}, { userId: 'u1' } as never),
      barcodes.generate({}, { userId: 'u1' } as never),
    ]);
    const values = results.map((r) => r.code);
    expect(new Set(values).size).toBe(values.length);
  });
});
