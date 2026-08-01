import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildRuntimePaths } from '../src/config/paths';
import { PrismaService } from '../src/database/prisma.service';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { AUDIT_EVENT } from '../src/core/auth.constants';

describe('Auth integration', () => {
  let app: INestApplication;
  let dataDir: string;
  let prisma: PrismaService;
  let accessToken = '';
  let refreshToken = '';
  let sessionId = '';

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'juman-auth-'));
    const paths = buildRuntimePaths(dataDir);
    ensureRuntimeDirectories(paths);
    const dbUrl = `file:${join(paths.dataDir, 'juman.db').replaceAll('\\', '/')}`;

    process.env.VITEST = 'true';
    process.env.APP_ENV = 'test';
    process.env.JUMAN_DATA_DIR = dataDir;
    process.env.DATABASE_URL = dbUrl;
    process.env.JWT_SECRET = 'juman-test-jwt-secret-with-enough-length!!';
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    process.env.MAX_FAILED_LOGIN_ATTEMPTS = '3';
    process.env.ACCOUNT_LOCK_DURATION_MINUTES = '30';

    execSync('pnpm exec prisma db push --skip-generate', {
      cwd: join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'pipe',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('POST /auth/login as seeded Administrator', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'Juman!Bootstrap1',
        rememberMe: true,
        deviceName: 'Juman Desktop',
      })
      .expect(200);

    expect(res.body.tokenType).toBe('bearer');
    expect(res.body.rememberMe).toBe(true);
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.permissions).toContain('users.manage');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    sessionId = res.body.sessionId;

    const loginEvent = await prisma.loginHistory.findFirst({
      where: { eventType: AUDIT_EVENT.LOGIN, success: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(loginEvent).toBeTruthy();
  });

  it('GET /auth/me and GET /auth/session', async () => {
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.sessionId).toBe(sessionId);

    const session = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(session.body.session.sessionId).toBe(sessionId);
    expect(session.body.session.user.permissions.length).toBeGreaterThan(0);
  });

  it('POST /auth/change-password clears mustChangePassword', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Juman!Bootstrap1',
        newPassword: 'NewStrong!Pass1',
      })
      .expect(200);

    const event = await prisma.loginHistory.findFirst({
      where: { eventType: AUDIT_EVENT.PASSWORD_CHANGED },
      orderBy: { createdAt: 'desc' },
    });
    expect(event).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1', rememberMe: false })
      .expect(200);
    expect(login.body.user.mustChangePassword).toBe(false);
    accessToken = login.body.accessToken;
    refreshToken = login.body.refreshToken;
  });

  it('restores session with X-Refresh-Token (Remember Me cold start)', async () => {
    const restored = await request(app.getHttpServer())
      .get('/auth/session')
      .set('X-Refresh-Token', refreshToken)
      .expect(200);
    expect(restored.body.tokens.accessToken).toBeTruthy();
    accessToken = restored.body.tokens.accessToken;
    refreshToken = restored.body.tokens.refreshToken;
  });

  it('POST /auth/logout invalidates tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    const logoutEvent = await prisma.loginHistory.findFirst({
      where: { eventType: AUDIT_EVENT.LOGOUT },
      orderBy: { createdAt: 'desc' },
    });
    expect(logoutEvent).toBeTruthy();
  });

  it('locks account and records LOGIN_FAILED + ACCOUNT_LOCKED', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1' })
      .expect(200);

    for (const pwd of ['bad1', 'bad2', 'bad3']) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: pwd })
        .expect(401);
    }

    const failed = await prisma.loginHistory.count({
      where: { eventType: AUDIT_EVENT.LOGIN_FAILED },
    });
    expect(failed).toBeGreaterThanOrEqual(3);

    const lockedEvent = await prisma.loginHistory.findFirst({
      where: { eventType: AUDIT_EVENT.ACCOUNT_LOCKED },
    });
    expect(lockedEvent).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'NewStrong!Pass1' })
      .expect(401);
  });

  it('GET /health remains public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
