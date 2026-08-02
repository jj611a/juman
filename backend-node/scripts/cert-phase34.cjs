/**
 * Phase 3.4 engineering certification harness.
 */
const { performance } = require('node:perf_hooks');
const { mkdtempSync, rmSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { join } = path;
const { execSync } = require('node:child_process');

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    startupMs: null,
    migrateMs: null,
    memRssMbAfterBoot: null,
    timings: {},
    security: [],
    api: [],
    database: {},
    errors: [],
  };

  const dataDir = mkdtempSync(join(tmpdir(), 'juman-cert-'));
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
  const { createGlobalValidationPipe } = require(path.join(__dirname, '../dist/src/validation/create-validation-pipe'));

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
      api('GET /health', res.body.status === 'ok' || res.body.status === 'degraded', res.body.status);
    });

    await timed('login_unknown', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'no_such_user_xyz', password: 'whatever' });
      sec('unknown username returns 401', res.status === 401, `status=${res.status}`);
    });

    {
      const res = await request(server)
        .get('/auth/me')
        .set('Authorization', 'Bearer totally.invalid.token');
      sec('invalid JWT rejected', res.status === 401, `status=${res.status}`);
    }

    let token = '';
    await timed('login_bootstrap', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'Juman!Bootstrap1' })
        .expect(200);
      token = res.body.accessToken;
      api('POST /auth/login', !!token, 'token issued');
    });

    await timed('change_password', async () => {
      await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Juman!Bootstrap1', newPassword: 'NewStrong!Pass1' })
        .expect(200);
    });

    await timed('login_new_password', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'NewStrong!Pass1' })
        .expect(200);
      token = res.body.accessToken;
    });

    await timed('auth_me', async () => {
      const res = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      api('GET /auth/me permissions', Array.isArray(res.body.permissions), `count=${res.body.permissions?.length}`);
      sec('admin has customer.view', res.body.permissions.includes('customer.view'), '');
      sec('admin has media.upload', res.body.permissions.includes('media.upload'), '');
    });

    await timed('auth_session', async () => {
      await request(server).get('/auth/session').set('Authorization', `Bearer ${token}`).expect(200);
    });

    let customerId = '';
    await timed('customer_create', async () => {
      const res = await request(server)
        .post('/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Cert User', phone: '07701110001', city: 'Baghdad' })
        .expect(201);
      customerId = res.body.id;
      api('POST /customers', !!customerId, res.body.customerNumber);
      sec('phone normalized', res.body.phoneNormalized === '9647701110001', res.body.phoneNormalized);
    });

    await timed('customer_duplicate', async () => {
      const res = await request(server)
        .post('/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Dup', phone: '07701110001' });
      sec('duplicate active phone 409', res.status === 409, `status=${res.status}`);
    });

    await timed('customer_search', async () => {
      const res = await request(server)
        .get('/customers/search')
        .query({ q: '7701110001', sortBy: 'fullName', sortDir: 'asc', limit: 10 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      api('GET /customers/search pagination', !!(res.body.meta && Array.isArray(res.body.items)), `total=${res.body.meta?.total}`);
    });

    await timed('customer_list_filter', async () => {
      const res = await request(server)
        .get('/customers')
        .query({ city: 'Baghdad', status: 'active', offset: 0, limit: 5 })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      api('GET /customers filter', res.body.meta.total >= 1, '');
    });

    await timed('customer_soft_delete_restore', async () => {
      await request(server).delete(`/customers/${customerId}`).set('Authorization', `Bearer ${token}`).expect(200);
      await request(server).get(`/customers/${customerId}`).set('Authorization', `Bearer ${token}`).expect(404);
      await request(server).post(`/customers/${customerId}/restore`).set('Authorization', `Bearer ${token}`).expect(200);
      api('customer soft-delete+restore', true, '');
    });

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    let mediaId = '';
    await timed('media_upload', async () => {
      const res = await request(server)
        .post('/media')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', png, 'cert.png')
        .expect(201);
      mediaId = res.body.id;
      api('POST /media', !!mediaId && !('relativePath' in res.body), `checksum=${String(res.body.checksum || '').slice(0, 8)}`);
    });

    await timed('media_integrity', async () => {
      const res = await request(server)
        .get(`/media/${mediaId}/integrity`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      sec('media integrity ok', res.body.ok === true, JSON.stringify(res.body));
    });

    await timed('media_restore_cycle', async () => {
      await request(server).delete(`/media/${mediaId}`).set('Authorization', `Bearer ${token}`).expect(200);
      await request(server).post(`/media/${mediaId}/restore`).set('Authorization', `Bearer ${token}`).expect(200);
    });

    {
      const res = await request(server)
        .post('/media')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('MZ'), 'evil.exe');
      sec('executable upload rejected', res.status === 400, `status=${res.status}`);
    }
    {
      const res = await request(server)
        .post('/media')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('not-png'), 'spoof.png');
      sec('MIME spoof rejected', res.status === 400, `status=${res.status}`);
    }
    {
      const big = Buffer.alloc(11 * 1024 * 1024, 1);
      const res = await request(server)
        .post('/media')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.concat([png, big]), 'huge.png');
      sec('oversized upload rejected', res.status === 400 || res.status === 413, `status=${res.status}`);
    }

    {
      const res = await request(server).get('/customers');
      sec('unauthenticated customers blocked', res.status === 401, `status=${res.status}`);
    }

    await timed('logout', async () => {
      await request(server).post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
      const res = await request(server).get('/auth/me').set('Authorization', `Bearer ${token}`);
      sec('revoked/logged-out JWT rejected', res.status === 401, `status=${res.status}`);
    });

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await prisma.$connect();
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const indexes = await prisma.$queryRawUnsafe(
      "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const fk = await prisma.$queryRawUnsafe('PRAGMA foreign_keys');
    report.database = {
      tableCount: tables.length,
      tables: tables.map((t) => t.name),
      indexCount: indexes.length,
      foreignKeysEnabled: Number(fk[0]?.foreign_keys) === 1,
      customerCount: await prisma.customer.count(),
      mediaCount: await prisma.mediaFile.count(),
      auditCount: await prisma.auditLog.count(),
    };
    try {
      await prisma.$transaction(async (tx) => {
        await tx.customer.create({
          data: {
            customerNumber: 'ROLLBACK-TEST',
            fullName: 'Rollback',
            phone: '07709999999',
            phoneNormalized: '9647709999999',
            status: 'active',
          },
        });
        throw new Error('force rollback');
      });
    } catch {
      /* expected */
    }
    const rolled = await prisma.customer.findUnique({ where: { customerNumber: 'ROLLBACK-TEST' } });
    sec('transaction rollback works', rolled === null, rolled ? 'row existed' : 'null');
    await prisma.$disconnect();

    const cats = ['images', 'documents', 'temp', 'thumbnails', 'imports', 'exports'];
    sec(
      'storage categories present',
      cats.every((c) => existsSync(join(paths.storageDir, c))),
      paths.storageDir,
    );
  } catch (err) {
    report.errors.push(String(err && err.stack ? err.stack : err));
  } finally {
    try {
      await app.close();
    } catch {
      /* ignore */
    }
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const out = join(process.cwd(), '..', 'docs', 'backend-v2', 'cert_p34_harness.json');
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log('WROTE', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

