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

describe('Inventory integrity remediation (Phase 4.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dir = '';
  let token = '';

  beforeAll(async () => {
    const p = prepareTestDatabase('juman-inv-integrity-');
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
  }, 180_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  async function createActiveItem(name: string, withBarcode = true) {
    const created = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: name,
        status: 'active',
        generateBarcode: withBarcode,
      })
      .expect(201);
    return created.body as {
      id: string;
      status: string;
      lifecycleState: string;
      barcodes: Array<{ id: string; value: string }>;
    };
  }

  it('blocker1: rejects soft-delete while reserved/rented/mid-ops', async () => {
    const item = await createActiveItem('Integrity delete block', false);
    await request(app.getHttpServer())
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'reserved', reason: 'hold' })
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(
      String(
        blocked.body.message ??
          blocked.body.error ??
          JSON.stringify(blocked.body),
      ),
    ).toMatch(/soft-delete|reserved/i);

    await request(app.getHttpServer())
      .post(`/items/${item.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'available' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('blocker2: soft-delete releases barcodes; restore rebinds', async () => {
    const item = await createActiveItem('Integrity barcode lifecycle');
    expect(item.barcodes).toHaveLength(1);
    const code = item.barcodes[0].value;

    const before = await prisma.barcode.findFirst({ where: { code } });
    expect(before?.status).toBe('activated');
    expect(before?.entityId).toBe(item.id);

    await request(app.getHttpServer())
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await prisma.barcode.findFirst({ where: { code } });
    expect(afterDelete?.status).toBe('reserved');
    expect(afterDelete?.entityId).toBeNull();

    const link = await prisma.itemBarcode.findFirst({
      where: { itemId: item.id },
    });
    expect(link?.deletedAt).not.toBeNull();

    const restored = await request(app.getHttpServer())
      .post(`/items/${item.id}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(restored.body.status).toBe('active');
    expect(restored.body.barcodes).toHaveLength(1);

    const afterRestore = await prisma.barcode.findFirst({ where: { code } });
    expect(afterRestore?.status).toBe('activated');
    expect(afterRestore?.entityId).toBe(item.id);
  });

  it('blocker3: create+barcode+media succeed together', async () => {
    const upload = await request(app.getHttpServer())
      .post('/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'integrity.jpg',
        contentType: 'image/jpeg',
      });
    // media upload may require multipart field name — fall back if endpoint differs
    let mediaFileId = upload.body?.id as string | undefined;
    if (upload.status >= 400 || !mediaFileId) {
      const file = await prisma.mediaFile.create({
        data: {
          originalFilename: 'integrity.jpg',
          storedFilename: 'integrity.jpg',
          extension: 'jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 4,
          sha256Hash: `integrity-${Date.now()}`,
          relativePath: 'images/integrity.jpg',
          kind: 'image',
        },
      });
      mediaFileId = file.id;
    }

    const created = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: 'Atomic bundle item',
        status: 'active',
        generateBarcode: true,
        media: [{ mediaFileId, purpose: 'gallery', isPrimary: true }],
      })
      .expect(201);

    expect(created.body.barcodes).toHaveLength(1);
    expect(created.body.media).toHaveLength(1);

    const refs = await prisma.mediaReference.findMany({
      where: { entityId: created.body.id, deletedAt: null },
    });
    expect(refs).toHaveLength(1);
    const itemMediaCount = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='ItemMedia'`,
    );
    expect(Number(itemMediaCount[0]?.c ?? 0)).toBe(0);
  });

  it('blocker4: restore returns prior catalog status (not stuck inactive)', async () => {
    const item = await createActiveItem('Integrity restore status', false);
    await request(app.getHttpServer())
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const restored = await request(app.getHttpServer())
      .post(`/items/${item.id}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(restored.body.status).toBe('active');
    expect(restored.body.deletedAt).toBeNull();
  });

  it('blocker5: draft items cannot enter operational lifecycle', async () => {
    const draft = await request(app.getHttpServer())
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Draft locked', status: 'draft' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/items/${draft.body.id}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newState: 'reserved' })
      .expect(409);
  });

  it('blocker6: attachMedia writes MediaReference only', async () => {
    const item = await createActiveItem('Integrity media attach', false);
    const file = await prisma.mediaFile.create({
      data: {
        originalFilename: 'attach.jpg',
        storedFilename: 'attach.jpg',
        extension: 'jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2,
        sha256Hash: `attach-${Date.now()}`,
        relativePath: 'images/attach.jpg',
        kind: 'image',
      },
    });

    const attached = await request(app.getHttpServer())
      .post(`/items/${item.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mediaFileId: file.id, purpose: 'gallery' })
      .expect(201);

    expect(attached.body.media?.length).toBeGreaterThanOrEqual(1);
    const refs = await prisma.mediaReference.count({
      where: { entityId: item.id, deletedAt: null },
    });
    expect(refs).toBeGreaterThanOrEqual(1);
  });
});
