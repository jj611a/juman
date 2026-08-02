/**
 * Phase 4.3 inventory engineering certification harness.
 * Verification only — no feature work.
 */
const { performance } = require('node:perf_hooks');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { join } = path;
const { execSync } = require('node:child_process');

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    migrateMs: null,
    startupMs: null,
    memRssMbAfterBoot: null,
    timings: {},
    security: [],
    api: [],
    database: {},
    errors: [],
  };

  const dataDir = mkdtempSync(join(tmpdir(), 'juman-cert43-'));
  process.env.VITEST = 'true';
  process.env.APP_ENV = 'test';
  process.env.JUMAN_DATA_DIR = dataDir;
  process.env.JWT_SECRET = 'juman-cert-jwt-secret-with-enough-length!!';
  process.env.HOST = '127.0.0.1';
  process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
  process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';

  const { buildRuntimePaths } = require(path.join(__dirname, '../dist/src/config/paths'));
  const { ensureRuntimeDirectories } = require(path.join(__dirname, '../dist/src/storage/ensure-dirs'));
  const paths = buildRuntimePaths(dataDir);
  ensureRuntimeDirectories(paths);
  process.env.DATABASE_URL = `file:${paths.sqlitePath.replaceAll('\\', '/')}`;

  const tMigrate0 = performance.now();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });
  report.migrateMs = Math.round(performance.now() - tMigrate0);

  require('reflect-metadata');
  const { Test } = require('@nestjs/testing');
  const request = require('supertest');
  const { AppModule } = require(path.join(__dirname, '../dist/src/app.module'));
  const { createGlobalValidationPipe } = require(
    path.join(__dirname, '../dist/src/validation/create-validation-pipe'),
  );
  const { PrismaService } = require(path.join(__dirname, '../dist/src/database/prisma.service'));
  const { LifecycleService } = require(
    path.join(__dirname, '../dist/src/inventory/lifecycle/lifecycle.service'),
  );

  const tBoot0 = performance.now();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();
  report.startupMs = Math.round(performance.now() - tBoot0);
  report.memRssMbAfterBoot = Math.round(process.memoryUsage().rss / (1024 * 1024));

  const server = app.getHttpServer();
  const timed = async (name, fn) => {
    const t0 = performance.now();
    const result = await fn();
    report.timings[name] = Math.round(performance.now() - t0);
    return result;
  };
  const sec = (name, ok, detail) => report.security.push({ name, ok, detail });
  const api = (name, ok, detail) => report.api.push({ name, ok, detail });

  try {
    await timed('health', async () => {
      const res = await request(server).get('/health').expect(200);
      api('GET /health', !!res.body.status, res.body.status);
    });

    {
      const res = await request(server).get('/items');
      sec('unauthenticated /items → 401', res.status === 401, `status=${res.status}`);
    }
    {
      const res = await request(server)
        .post('/items/00000000-0000-4000-8000-000000000001/transition')
        .send({ newState: 'reserved' });
      sec('unauthenticated transition → 401', res.status === 401, `status=${res.status}`);
    }

    let token = '';
    await timed('login_bootstrap', async () => {
      const login = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'Juman!Bootstrap1' })
        .expect(200);
      token = login.body.accessToken;
      await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Juman!Bootstrap1',
          newPassword: 'NewStrong!Pass1',
        })
        .expect(200);
      const again = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'NewStrong!Pass1' })
        .expect(200);
      token = again.body.accessToken;
      api('auth bootstrap', !!token, 'password changed + re-login');
    });

    const auth = { Authorization: `Bearer ${token}` };

    let categoryId = '';
    let brandId = '';
    let colorId = '';
    let sizeId = '';
    let itemId = '';

    await timed('taxonomy_create', async () => {
      categoryId = (
        await request(server).post('/categories').set(auth).send({ name: 'CertCat' }).expect(201)
      ).body.id;
      brandId = (
        await request(server).post('/brands').set(auth).send({ name: 'CertBrand' }).expect(201)
      ).body.id;
      colorId = (
        await request(server)
          .post('/colors')
          .set(auth)
          .send({ name: 'CertColor', hexCode: '#112233' })
          .expect(201)
      ).body.id;
      sizeId = (
        await request(server).post('/sizes').set(auth).send({ name: 'L', sortOrder: 1 }).expect(201)
      ).body.id;
      api('taxonomy CRUD create', !!(categoryId && brandId && colorId && sizeId), 'ok');
    });

    await timed('item_create_barcode', async () => {
      const item = await request(server)
        .post('/items')
        .set(auth)
        .send({
          displayName: 'Cert Item',
          categoryId,
          brandId,
          colorId,
          sizeId,
          status: 'active',
          purchasePrice: 1000,
          generateBarcode: true,
        })
        .expect(201);
      itemId = item.body.id;
      api(
        'item create + barcode',
        item.body.lifecycleState === 'available' && item.body.barcodes?.length === 1,
        `code=${item.body.internalCode} barcodes=${item.body.barcodes?.length}`,
      );
    });

    await timed('catalog_search', async () => {
      const list = await request(server)
        .get('/items')
        .query({ q: 'Cert', categoryId, status: 'active' })
        .set(auth)
        .expect(200);
      api('catalog search/filter', list.body.meta.total >= 1, `total=${list.body.meta.total}`);
    });

    await timed('barcode_lookup', async () => {
      const byCode = await request(server)
        .get(`/items/code/${(await request(server).get(`/items/${itemId}`).set(auth)).body.internalCode}`)
        .set(auth)
        .expect(200);
      api('barcode/internal code lookup', byCode.body.id === itemId, byCode.body.internalCode);
    });

    await timed('lifecycle_transition', async () => {
      const bad = await request(server)
        .post(`/items/${itemId}/transition`)
        .set(auth)
        .send({ newState: 'rented' });
      sec('state skip rejected', bad.status === 409, `status=${bad.status}`);

      const ok = await request(server)
        .post(`/items/${itemId}/transition`)
        .set(auth)
        .send({ newState: 'reserved', reason: 'cert', expectedState: 'available' })
        .expect(200);
      api('valid transition', ok.body.lifecycleState === 'reserved', ok.body.lifecycleState);

      const edit = await request(server)
        .patch(`/items/${itemId}`)
        .set(auth)
        .send({ displayName: 'blocked' });
      sec('edit while reserved blocked', edit.status === 409, `status=${edit.status}`);
    });

    await timed('history_retrieval', async () => {
      const hist = await request(server)
        .get(`/items/${itemId}/history`)
        .set(auth)
        .expect(200);
      api('history retrieval', hist.body.meta.total >= 2, `total=${hist.body.meta.total}`);
    });

    await timed('concurrent_transitions', async () => {
      const lifecycle = app.get(LifecycleService);
      // move back to available first
      await lifecycle.transition(itemId, { newState: 'available', expectedState: 'reserved' });
      const results = await Promise.allSettled([
        lifecycle.transition(itemId, { newState: 'reserved', expectedState: 'available' }),
        lifecycle.transition(itemId, { newState: 'for_sale', expectedState: 'available' }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.filter((r) => r.status === 'rejected').length;
      sec('concurrent CAS one-wins', ok === 1 && fail === 1, `ok=${ok} fail=${fail}`);
    });

    {
      const deleted = await request(server).delete(`/items/${itemId}`).set(auth).expect(200);
      api('soft delete', deleted.body.deletedAt != null || deleted.status === 200, 'deleted');
      const gone = await request(server).get(`/items/${itemId}`).set(auth);
      sec('deleted item get → 404', gone.status === 404, `status=${gone.status}`);
      const transitionDeleted = await request(server)
        .post(`/items/${itemId}/transition`)
        .set(auth)
        .send({ newState: 'available' });
      sec(
        'deleted item transition rejected',
        transitionDeleted.status === 404 || transitionDeleted.status === 409,
        `status=${transitionDeleted.status}`,
      );
      await request(server).post(`/items/${itemId}/restore`).set(auth).expect(200);
      api('restore', true, 'restored');
    }

    {
      const invalid = await request(server)
        .post('/items')
        .set(auth)
        .send({ displayName: 'x', salePrice: -1 });
      sec('invalid payload → 400', invalid.status === 400, `status=${invalid.status}`);
    }

    const prisma = app.get(PrismaService);
    const tables = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const indexes = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`,
    );
    const fk = await prisma.$queryRawUnsafe('PRAGMA foreign_keys');
    report.database = {
      tableCount: tables.length,
      indexCount: indexes.length,
      foreignKeys: fk[0]?.foreign_keys === 1 || fk[0]?.foreign_keys === true,
      hasItem: tables.some((t) => t.name === 'Item'),
      hasItemStateHistory: tables.some((t) => t.name === 'ItemStateHistory'),
      hasItemMedia: tables.some((t) => t.name === 'ItemMedia'),
      hasItemBarcode: tables.some((t) => t.name === 'ItemBarcode'),
    };
    api(
      'schema inventory tables',
      report.database.hasItem &&
        report.database.hasItemStateHistory &&
        report.database.hasItemMedia &&
        report.database.hasItemBarcode,
      JSON.stringify(report.database),
    );

    // Probe known debt: soft-delete while reserved is currently allowed
    {
      const debtItem = await request(server)
        .post('/items')
        .set(auth)
        .send({ displayName: 'Debt Probe', status: 'active', generateBarcode: true })
        .expect(201);
      await request(server)
        .post(`/items/${debtItem.body.id}/transition`)
        .set(auth)
        .send({ newState: 'reserved' })
        .expect(200);
      const del = await request(server).delete(`/items/${debtItem.body.id}`).set(auth);
      report.security.push({
        name: 'DEBT soft-delete while reserved currently allowed',
        ok: true,
        detail: `observed_status=${del.status} (expected until Must-Fix; documents debt)`,
        debt: true,
      });
    }
  } catch (err) {
    report.errors.push(String(err && err.stack ? err.stack : err));
  } finally {
    await app.close();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const outJson = join(process.cwd(), '..', 'docs', 'backend-v2', 'cert_p43_harness.json');
  writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ written: outJson, summary: {
    migrateMs: report.migrateMs,
    startupMs: report.startupMs,
    timings: report.timings,
    securityPass: report.security.filter((s) => s.ok && !s.debt).length,
    securityTotal: report.security.filter((s) => !s.debt).length,
    apiPass: report.api.filter((a) => a.ok).length,
    apiTotal: report.api.length,
    errors: report.errors.length,
    database: report.database,
  } }, null, 2));

  if (report.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
