import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';

function png1x1(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

describe('Media integration', () => {
  let app: INestApplication;
  let dataDir: string;
  let token = '';
  let mediaId = '';

  beforeAll(async () => {
    const prepared = prepareTestDatabase('juman-media-');
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

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/media').expect(401);
  });

  it('uploads lists gets verifies soft-deletes and restores', async () => {
    const uploaded = await request(app.getHttpServer())
      .post('/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', png1x1(), 'sample.png')
      .expect(201);

    expect(uploaded.body.id).toBeTruthy();
    expect(uploaded.body.checksum).toHaveLength(64);
    expect(uploaded.body.extension).toBe('png');
    expect(uploaded.body).not.toHaveProperty('relativePath');
    expect(uploaded.body.width).toBe(1);
    mediaId = uploaded.body.id;

    // duplicate upload allowed
    await request(app.getHttpServer())
      .post('/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', png1x1(), 'sample-copy.png')
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/media')
      .query({ extension: 'png' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(2);

    const byId = await request(app.getHttpServer())
      .get(`/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(byId.body.id).toBe(mediaId);

    const integrity = await request(app.getHttpServer())
      .get(`/media/${mediaId}/integrity`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(integrity.body.ok).toBe(true);

    await request(app.getHttpServer())
      .post('/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('MZ'), 'evil.exe')
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const deleted = await request(app.getHttpServer())
      .get('/media')
      .query({ deleted: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deleted.body.items.some((m: { id: string }) => m.id === mediaId)).toBe(true);

    await request(app.getHttpServer())
      .post(`/media/${mediaId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
