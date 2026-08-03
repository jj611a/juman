/**
 * Phase 8.1 — Full end-to-end system certification harness.
 * Verification + metrics. Does not change business formulas.
 *
 * Run (from backend-node, after build):
 *   node scripts/cert-phase81-e2e.cjs
 */
const { performance } = require('node:perf_hooks');
const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { join } = path;
const { execSync } = require('node:child_process');

const OUT_DIR = join(__dirname, '../../docs/CERTIFICATION');
const HARNESS_JSON = join(OUT_DIR, 'cert_p81_harness.json');

function verdict(ok, warn = false) {
  if (ok && !warn) return 'PASS';
  if (ok && warn) return 'WARNING';
  return 'FAIL';
}

async function main() {
  const report = {
    phase: '8.1',
    title: 'Full End-to-End System Certification',
    generatedAt: new Date().toISOString(),
    migrateMs: null,
    startupMs: null,
    memRssMbAfterBoot: null,
    memRssMbAfterStress: null,
    timings: {},
    cases: [],
    stress: {},
    formula: {},
    errors: [],
  };

  const record = (id, area, ok, detail, risk = 'medium', warn = false) => {
    report.cases.push({
      id,
      area,
      result: verdict(ok, warn),
      risk,
      detail: String(detail ?? ''),
    });
  };

  const dataDir = mkdtempSync(join(tmpdir(), 'juman-cert81-'));
  process.env.VITEST = 'true';
  process.env.APP_ENV = 'test';
  process.env.JUMAN_DATA_DIR = dataDir;
  process.env.JWT_SECRET = 'juman-cert81-jwt-secret-with-enough-length!!';
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
  const {
    computeSettlementTotalFils,
    computeOutstandingFils,
  } = require(path.join(__dirname, '../dist/src/finance/settlement/settlement.formula'));

  const tBoot0 = performance.now();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();
  report.startupMs = Math.round(performance.now() - tBoot0);
  report.memRssMbAfterBoot = Math.round(process.memoryUsage().rss / (1024 * 1024));

  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);

  const timed = async (name, fn) => {
    const t0 = performance.now();
    const result = await fn();
    report.timings[name] = Math.round(performance.now() - t0);
    return result;
  };

  const day = (offset) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(12, 0, 0, 0);
    return d.toISOString();
  };

  let token = '';
  const auth = () => ({ Authorization: `Bearer ${token}` });

  try {
    // -------- AUTH --------
    await timed('auth.wrong_password', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'WrongPass!!1' });
      record('AUTH-01', 'auth', res.status === 401, `status=${res.status}`, 'high');
    });

    await timed('auth.login_bootstrap', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'Juman!Bootstrap1' });
      record(
        'AUTH-02',
        'auth',
        res.status === 200 && !!res.body.accessToken && !!res.body.refreshToken,
        `status=${res.status} hasAccess=${!!res.body.accessToken}`,
        'critical',
      );
      token = res.body.accessToken;
      record(
        'AUTH-03',
        'auth',
        Array.isArray(res.body.user?.permissions) && res.body.user.permissions.length > 0,
        `perms=${res.body.user?.permissions?.length ?? 0}`,
        'high',
      );
    });

    await timed('auth.change_password', async () => {
      const res = await request(server)
        .post('/auth/change-password')
        .set(auth())
        .send({
          currentPassword: 'Juman!Bootstrap1',
          newPassword: 'NewStrong!Pass1',
        });
      record('AUTH-04', 'auth', res.status === 200 || res.status === 201, `status=${res.status}`, 'high');
    });

    await timed('auth.relogin', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'NewStrong!Pass1' });
      record('AUTH-05', 'auth', res.status === 200 && !!res.body.accessToken, `status=${res.status}`, 'critical');
      token = res.body.accessToken;
    });

    await timed('auth.session_bearer', async () => {
      const res = await request(server).get('/auth/session').set(auth());
      record(
        'AUTH-06',
        'auth',
        res.status === 200 && !!res.body.session?.user?.username,
        `status=${res.status}`,
        'high',
      );
    });

    await timed('auth.session_refresh_header', async () => {
      // login again to get refresh
      const login = await request(server)
        .post('/auth/login')
        .send({ username: 'admin', password: 'NewStrong!Pass1', rememberMe: true });
      const refresh = login.body.refreshToken;
      const res = await request(server)
        .get('/auth/session')
        .set('X-Refresh-Token', refresh);
      const ok =
        res.status === 200 &&
        (!!res.body.tokens?.accessToken || !!res.body.session?.user);
      record('AUTH-07', 'auth', ok, `status=${res.status} hasTokens=${!!res.body.tokens}`, 'high');
      if (res.body.tokens?.accessToken) token = res.body.tokens.accessToken;
      else if (login.body.accessToken) token = login.body.accessToken;
    });

    await timed('auth.me', async () => {
      const res = await request(server).get('/auth/me').set(auth());
      record('AUTH-08', 'auth', res.status === 200 && !!res.body.permissions, `status=${res.status}`, 'medium');
    });

    await timed('auth.unauthenticated', async () => {
      const res = await request(server).get('/customers');
      record('AUTH-09', 'auth', res.status === 401, `status=${res.status}`, 'critical');
    });

    // -------- CUSTOMERS --------
    let customerId = '';
    await timed('customers.crud', async () => {
      const create = await request(server)
        .post('/customers')
        .set(auth())
        .send({ fullName: 'Cert Customer', phone: '07901234567', city: 'Baghdad' });
      record('CUS-01', 'customers', create.status === 201, `status=${create.status}`, 'critical');
      customerId = create.body.id;

      const dup = await request(server)
        .post('/customers')
        .set(auth())
        .send({ fullName: 'Dup', phone: '07901234567' });
      record('CUS-02', 'customers', dup.status === 409 || dup.status === 400, `status=${dup.status}`, 'high');

      const patch = await request(server)
        .patch(`/customers/${customerId}`)
        .set(auth())
        .send({ fullName: 'Cert Customer Updated' });
      record('CUS-03', 'customers', patch.status === 200 && patch.body.fullName.includes('Updated'), `status=${patch.status}`, 'high');

      const list = await request(server)
        .get('/customers')
        .query({ q: 'Cert', offset: 0, limit: 10, sortBy: 'fullName', sortDir: 'asc' })
        .set(auth());
      record(
        'CUS-04',
        'customers',
        list.status === 200 && Array.isArray(list.body.items) && list.body.meta?.total >= 1,
        `total=${list.body.meta?.total}`,
        'high',
      );

      const del = await request(server).delete(`/customers/${customerId}`).set(auth());
      record('CUS-05', 'customers', del.status === 200, `status=${del.status}`, 'high');

      const restore = await request(server).post(`/customers/${customerId}/restore`).set(auth());
      record('CUS-06', 'customers', restore.status === 200, `status=${restore.status}`, 'high');
    });

    // -------- INVENTORY / TAXONOMY --------
    let categoryId = '';
    let brandId = '';
    let colorId = '';
    let sizeId = '';
    let itemId = '';
    let itemId2 = '';

    await timed('inventory.taxonomy_and_items', async () => {
      const cat = await request(server).post('/categories').set(auth()).send({ name: 'Cert Cat' });
      categoryId = cat.body.id;
      const brand = await request(server).post('/brands').set(auth()).send({ name: 'Cert Brand' });
      brandId = brand.body.id;
      const color = await request(server).post('/colors').set(auth()).send({ name: 'Cert Red', hexCode: '#ff0000' });
      colorId = color.body.id;
      const size = await request(server).post('/sizes').set(auth()).send({ name: 'M' });
      sizeId = size.body.id;
      record(
        'INV-01',
        'inventory',
        !!(categoryId && brandId && colorId && sizeId),
        'taxonomy created',
        'high',
      );

      const item = await request(server)
        .post('/items')
        .set(auth())
        .send({
          displayName: 'Cert Dress A',
          status: 'active',
          categoryId,
          brandId,
          colorId,
          sizeId,
          rentalPrice: 5000,
          purchasePrice: 100000,
          generateBarcode: true,
        });
      record('INV-02', 'inventory', item.status === 201 && item.body.lifecycleState === 'available', `status=${item.status} life=${item.body.lifecycleState}`, 'critical');
      itemId = item.body.id;

      const item2 = await request(server)
        .post('/items')
        .set(auth())
        .send({
          displayName: 'Cert Dress B',
          status: 'active',
          rentalPrice: 7000,
          generateBarcode: true,
        });
      itemId2 = item2.body.id;

      const search = await request(server)
        .get('/items')
        .query({ q: 'Cert Dress', offset: 0, limit: 20 })
        .set(auth());
      record('INV-03', 'inventory', search.body.meta?.total >= 2, `total=${search.body.meta?.total}`, 'medium');

      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      const media = await request(server)
        .post('/media')
        .set(auth())
        .attach('file', png, {
          filename: 'cert.png',
          contentType: 'image/png',
        });
      const mediaOk = media.status === 201 || media.status === 200;
      record('MED-01', 'media', mediaOk, `status=${media.status} msg=${media.body?.message || ''}`, 'high');
      if (mediaOk && media.body.id) {
        const attach = await request(server)
          .post(`/items/${itemId}/media`)
          .set(auth())
          .send({ mediaFileId: media.body.id, isPrimary: true });
        record('MED-02', 'media', attach.status === 200 || attach.status === 201, `status=${attach.status}`, 'medium');
        const delMedia = await request(server).delete(`/media/${media.body.id}`).set(auth());
        record('MED-03', 'media', delMedia.status === 200, `status=${delMedia.status}`, 'medium');
        const restoreMedia = await request(server).post(`/media/${media.body.id}/restore`).set(auth());
        record('MED-04', 'media', restoreMedia.status === 200, `status=${restoreMedia.status}`, 'medium');
      } else {
        record('MED-02', 'media', false, 'skipped — upload failed', 'medium');
      }

      const soft = await request(server).delete(`/items/${itemId2}`).set(auth());
      record('INV-04', 'inventory', soft.status === 200, `status=${soft.status}`, 'medium');
      const undel = await request(server).post(`/items/${itemId2}/restore`).set(auth());
      record('INV-05', 'inventory', undel.status === 200, `status=${undel.status}`, 'medium');
    });

    // -------- RESERVATIONS --------
    let reservationId = '';
    await timed('reservations.flow', async () => {
      const create = await request(server)
        .post('/reservations')
        .set(auth())
        .send({
          customerId,
          startDate: day(1),
          expectedCheckoutDate: day(2),
          expectedReturnDate: day(5),
          items: [{ itemId, agreedRentalPrice: 5000 }],
        });
      record('RES-01', 'reservations', create.status === 201, `status=${create.status} body=${JSON.stringify(create.body?.message || create.body?.status || '')}`, 'critical');
      reservationId = create.body.id;

      // Overlap conflict
      const overlap = await request(server)
        .post('/reservations')
        .set(auth())
        .send({
          customerId,
          startDate: day(2),
          expectedCheckoutDate: day(3),
          expectedReturnDate: day(4),
          items: [{ itemId, agreedRentalPrice: 5000 }],
        });
      record(
        'RES-02',
        'reservations',
        overlap.status === 409 || overlap.status === 400,
        `status=${overlap.status}`,
        'critical',
      );

      const cancel = await request(server)
        .post(`/reservations/${reservationId}/cancel`)
        .set(auth())
        .send({ reason: 'cert cancel' });
      record('RES-03', 'reservations', cancel.status === 200, `status=${cancel.status}`, 'high');

      // fresh reservation for checkout path
      const create2 = await request(server)
        .post('/reservations')
        .set(auth())
        .send({
          customerId,
          startDate: day(10),
          expectedCheckoutDate: day(11),
          expectedReturnDate: day(14),
          items: [{ itemId, agreedRentalPrice: 5000 }],
        });
      reservationId = create2.body.id;
    });

    // -------- RENTALS + FINANCE --------
    let rentalId = '';
    let settlementId = '';
    await timed('rentals.walkin_checkout_return', async () => {
      // need available item — use itemId2
      const walk = await request(server)
        .post('/rentals')
        .set(auth())
        .send({
          customerId,
          rentalDate: day(0),
          expectedReturnDate: day(3),
          items: [{ itemId: itemId2, agreedRentalPrice: 7000 }],
        });
      record('REN-01', 'rentals', walk.status === 201, `status=${walk.status}`, 'critical');
      rentalId = walk.body.id;

      const checkout = await request(server)
        .post(`/rentals/${rentalId}/checkout`)
        .set(auth())
        .send({ depositAmountFils: 1000, idempotencyKey: 'cert-checkout-1' });
      record('REN-02', 'rentals', checkout.status === 200, `status=${checkout.status}`, 'critical');

      const checkout2 = await request(server)
        .post(`/rentals/${rentalId}/checkout`)
        .set(auth())
        .send({ depositAmountFils: 1000, idempotencyKey: 'cert-checkout-1' });
      record(
        'REN-03',
        'rentals',
        checkout2.status === 200 || checkout2.status === 409,
        `idempotent status=${checkout2.status}`,
        'high',
        checkout2.status === 409,
      );

      const settList = await request(server)
        .get('/settlements')
        .query({ rentalId })
        .set(auth());
      settlementId = settList.body.items?.[0]?.id;
      record('FIN-01', 'finance', !!settlementId, `settlement=${settlementId}`, 'critical');

      if (settlementId) {
        const s = settList.body.items[0];
        const expectedTotal = computeSettlementTotalFils({
          chargeFils: s.chargeFils,
          depositFils: s.depositFils,
          lateFeeFils: s.lateFeeFils ?? 0,
          adjustmentFils: s.adjustmentFils ?? 0,
          discountFils: s.discountFils ?? 0,
          refundFils: s.refundFils ?? 0,
        });
        const expectedRem = computeOutstandingFils(expectedTotal, s.paidFils ?? 0);
        const formulaOk = s.totalFils === expectedTotal && s.remainingFils === expectedRem;
        report.formula = {
          chargeFils: s.chargeFils,
          depositFils: s.depositFils,
          totalFils: s.totalFils,
          remainingFils: s.remainingFils,
          expectedTotal,
          expectedRem,
          ok: formulaOk,
        };
        record('FIN-02', 'finance', formulaOk, `total=${s.totalFils} expected=${expectedTotal}`, 'critical');

        const pay = await request(server)
          .post(`/settlements/${settlementId}/payment`)
          .set(auth())
          .send({ amountFils: Math.min(2000, s.remainingFils), method: 'cash', idempotencyKey: 'cert-pay-1' });
        record('FIN-03', 'finance', pay.status === 200 || pay.status === 201, `status=${pay.status}`, 'critical');

        const disc = await request(server)
          .post(`/settlements/${settlementId}/discount`)
          .set(auth())
          .send({ kind: 'fixed', amountFils: 100, reason: 'cert discount', idempotencyKey: 'cert-disc-1' });
        record('FIN-04', 'finance', disc.status === 200 || disc.status === 201, `status=${disc.status}`, 'high');

        const adj = await request(server)
          .post(`/settlements/${settlementId}/adjustment`)
          .set(auth())
          .send({ amountFils: 50, reason: 'cert adj', idempotencyKey: 'cert-adj-1' });
        record('FIN-05', 'finance', adj.status === 200 || adj.status === 201, `status=${adj.status}`, 'high');

        const late = await request(server)
          .post(`/settlements/${settlementId}/late-fee`)
          .set(auth())
          .send({ kind: 'flat', flatFils: 25, reason: 'cert late', idempotencyKey: 'cert-late-1' });
        record('FIN-06', 'finance', late.status === 200 || late.status === 201, `status=${late.status}`, 'high');

        // pay remaining
        const after = await request(server).get(`/settlements/${settlementId}`).set(auth());
        const rem = after.body.remainingFils ?? 0;
        if (rem > 0) {
          const pay2 = await request(server)
            .post(`/settlements/${settlementId}/payment`)
            .set(auth())
            .send({ amountFils: rem, method: 'cash', idempotencyKey: 'cert-pay-2' });
          record('FIN-07', 'finance', pay2.status === 200 || pay2.status === 201, `pay rem status=${pay2.status}`, 'critical');
        } else {
          record('FIN-07', 'finance', true, 'already paid', 'critical');
        }

        const refund = await request(server)
          .post(`/settlements/${settlementId}/refund`)
          .set(auth())
          .send({ amountFils: 50, reason: 'cert refund', idempotencyKey: 'cert-ref-1' });
        // may fail if remaining increases — still record
        record(
          'FIN-08',
          'finance',
          refund.status < 500,
          `status=${refund.status}`,
          'medium',
          refund.status >= 400,
        );
      }

      const ret = await request(server)
        .post(`/rentals/${rentalId}/return`)
        .set(auth())
        .send({ reason: 'cert return' });
      record('REN-04', 'rentals', ret.status === 200, `status=${ret.status}`, 'critical');
    });

    await timed('rentals.reservation_checkout', async () => {
      const co = await request(server)
        .post(`/reservations/${reservationId}/checkout`)
        .set(auth())
        .send({ depositAmountFils: 500, idempotencyKey: 'cert-res-co-1' });
      record('RES-04', 'reservations', co.status === 200, `status=${co.status}`, 'critical');
    });

    // -------- REPORTS --------
    await timed('reports.suite', async () => {
      const dash = await request(server).get('/reports/dashboard').set(auth());
      record(
        'RPT-01',
        'reports',
        dash.status === 200 && typeof dash.body.activeRentals === 'number',
        `activeRentals=${dash.body.activeRentals}`,
        'high',
      );

      const fin = await request(server).get('/reports/financial').set(auth());
      record('RPT-02', 'reports', fin.status === 200 && typeof fin.body.revenueFils === 'number', `revenue=${fin.body.revenueFils}`, 'high');

      const inv = await request(server).get('/reports/inventory/availability').set(auth());
      record('RPT-03', 'reports', inv.status === 200 && Array.isArray(inv.body), `rows=${inv.body?.length}`, 'medium');

      const rentCur = await request(server).get('/reports/rentals/current').set(auth());
      record('RPT-04', 'reports', rentCur.status === 200 && Array.isArray(rentCur.body.items), `items=${rentCur.body.items?.length}`, 'medium');

      const csv = await request(server)
        .get('/reports/export')
        .query({ report: 'dashboard', format: 'csv' })
        .set(auth());
      record('RPT-05', 'reports', csv.status === 200, `csv status=${csv.status}`, 'high');

      const json = await request(server)
        .get('/reports/export')
        .query({ report: 'financial', format: 'json' })
        .set(auth());
      record('RPT-06', 'reports', json.status === 200, `json status=${json.status}`, 'high');

      const pdf = await request(server)
        .get('/reports/export')
        .query({ report: 'dashboard', format: 'pdf' })
        .set(auth());
      record('RPT-07', 'reports', pdf.status === 400, `pdf stub status=${pdf.status}`, 'low');

      const cust = await request(server)
        .get(`/reports/customers/${customerId}/outstanding`)
        .set(auth());
      record('RPT-08', 'reports', cust.status === 200, `status=${cust.status}`, 'medium');
    });

    // -------- STRESS --------
    await timed('stress.bulk', async () => {
      const N_CUSTOMERS = 80;
      const N_ITEMS = 120;
      const N_RENTALS = 40;

      const tCust0 = performance.now();
      for (let i = 0; i < N_CUSTOMERS; i += 1) {
        await request(server)
          .post('/customers')
          .set(auth())
          .send({ fullName: `Stress Cust ${i}`, phone: `0770${String(1000000 + i)}` });
      }
      report.stress.customersMs = Math.round(performance.now() - tCust0);
      report.stress.customers = N_CUSTOMERS;

      const tItem0 = performance.now();
      const stressItemIds = [];
      for (let i = 0; i < N_ITEMS; i += 1) {
        const r = await request(server)
          .post('/items')
          .set(auth())
          .send({
            displayName: `Stress Item ${i}`,
            status: 'active',
            rentalPrice: 1000 + (i % 50) * 100,
            generateBarcode: true,
          });
        if (r.body?.id) stressItemIds.push(r.body.id);
      }
      report.stress.itemsMs = Math.round(performance.now() - tItem0);
      report.stress.items = stressItemIds.length;

      const tList0 = performance.now();
      const bigList = await request(server)
        .get('/items')
        .query({ offset: 0, limit: 50 })
        .set(auth());
      report.stress.listItemsMs = Math.round(performance.now() - tList0);
      record(
        'STR-01',
        'stress',
        bigList.status === 200 && bigList.body.meta.total >= N_ITEMS,
        `total=${bigList.body.meta?.total} listMs=${report.stress.listItemsMs}`,
        'high',
        report.stress.listItemsMs > 2000,
      );

      const tRent0 = performance.now();
      let rentOk = 0;
      for (let i = 0; i < N_RENTALS; i += 1) {
        const iid = stressItemIds[i];
        if (!iid) break;
        const cust = await prisma.customer.findFirst({
          where: { fullName: `Stress Cust ${i % N_CUSTOMERS}`, deletedAt: null },
        });
        if (!cust) continue;
        const rental = await request(server)
          .post('/rentals')
          .set(auth())
          .send({
            customerId: cust.id,
            rentalDate: day(0),
            expectedReturnDate: day(2),
            items: [{ itemId: iid, agreedRentalPrice: 1500 }],
          });
        if (rental.status !== 201) continue;
        const co = await request(server)
          .post(`/rentals/${rental.body.id}/checkout`)
          .set(auth())
          .send({ depositAmountFils: 0, idempotencyKey: `stress-co-${i}` });
        if (co.status === 200) rentOk += 1;
      }
      report.stress.rentalsMs = Math.round(performance.now() - tRent0);
      report.stress.rentalsOk = rentOk;
      record(
        'STR-02',
        'stress',
        rentOk >= Math.floor(N_RENTALS * 0.7),
        `rentalsOk=${rentOk}/${N_RENTALS}`,
        'high',
        rentOk < N_RENTALS,
      );

      const tDash0 = performance.now();
      const dash = await request(server).get('/reports/dashboard').set(auth());
      report.stress.dashboardMs = Math.round(performance.now() - tDash0);
      record(
        'STR-03',
        'stress',
        dash.status === 200 && report.stress.dashboardMs < 3000,
        `dashboardMs=${report.stress.dashboardMs}`,
        'medium',
        report.stress.dashboardMs > 1000,
      );

      report.memRssMbAfterStress = Math.round(process.memoryUsage().rss / (1024 * 1024));
      const memDelta = report.memRssMbAfterStress - report.memRssMbAfterBoot;
      record(
        'STR-04',
        'stress',
        memDelta < 400,
        `rssBoot=${report.memRssMbAfterBoot} rssAfter=${report.memRssMbAfterStress} delta=${memDelta}`,
        'medium',
        memDelta > 200,
      );
    });

    // -------- LOGOUT --------
    await timed('auth.logout', async () => {
      const res = await request(server).post('/auth/logout').set(auth());
      record('AUTH-10', 'auth', res.status === 200 || res.status === 201, `status=${res.status}`, 'high');
      const after = await request(server).get('/customers').set(auth());
      record('AUTH-11', 'auth', after.status === 401, `post-logout status=${after.status}`, 'high', after.status !== 401);
    });

    // Static architecture checks (integration consistency)
    record(
      'ARCH-01',
      'architecture',
      true,
      'Nest responses camelCase; Electron façade maps to legacy envelopes (Phase 8.0)',
      'medium',
      true,
    );
    record(
      'ARCH-02',
      'architecture',
      true,
      'Settings/Audit/Calendar/Users HTTP absent — nav pruned; not runtime failures',
      'medium',
      true,
    );
    record(
      'ARCH-03',
      'architecture',
      true,
      'Diagnostics UI still references PostgreSQL/Python — packaging debt',
      'high',
      true,
    );
    record(
      'HW-01',
      'hardware',
      true,
      'Hardware paths are local IPC — not exercised in Nest HTTP harness',
      'medium',
      true,
    );
    record(
      'SET-01',
      'settings',
      true,
      'No Nest settings HTTP — V2_UNSUPPORTED in frontend',
      'medium',
      true,
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

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(HARNESS_JSON, JSON.stringify(report, null, 2), 'utf8');
  const pass = report.cases.filter((c) => c.result === 'PASS').length;
  const warn = report.cases.filter((c) => c.result === 'WARNING').length;
  const fail = report.cases.filter((c) => c.result === 'FAIL').length;
  console.log(
    JSON.stringify(
      {
        out: HARNESS_JSON,
        pass,
        warn,
        fail,
        startupMs: report.startupMs,
        migrateMs: report.migrateMs,
        memRssMbAfterBoot: report.memRssMbAfterBoot,
        memRssMbAfterStress: report.memRssMbAfterStress,
        stress: report.stress,
        formula: report.formula,
        errors: report.errors.length,
      },
      null,
      2,
    ),
  );
  if (fail > 0 || report.errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
