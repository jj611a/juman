import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';

async function main() {
  const p = prepareTestDatabase('juman-sales-dbg-');
  process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
  process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
  process.env.JUMAN_SEED_DEMO = '0';
  const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = m.createNestApplication();
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();
  let r = await request(app.getHttpServer()).post('/auth/login').send({ username: 'admin', password: 'Juman!Bootstrap1' });
  let token = r.body.accessToken;
  await request(app.getHttpServer()).post('/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'Juman!Bootstrap1', newPassword: 'NewStrong!Pass1' });
  r = await request(app.getHttpServer()).post('/auth/login').send({ username: 'admin', password: 'NewStrong!Pass1' });
  token = r.body.accessToken;
  const item = await request(app.getHttpServer()).post('/items').set('Authorization', `Bearer ${token}`).send({ displayName: 'X', status: 'active', salePrice: 1000, generateBarcode: true });
  console.log('ITEM', item.status, JSON.stringify(item.body).slice(0,200));
  const sale = await request(app.getHttpServer()).post('/sales').set('Authorization', `Bearer ${token}`).send({ items: [{ itemId: item.body.id }] });
  console.log('SALE', sale.status, JSON.stringify(sale.body));
  const server = app.getHttpServer();
  const router = app.getHttpAdapter().getInstance()?._router;
  await app.close();
  rmSync(p.dataDir, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
