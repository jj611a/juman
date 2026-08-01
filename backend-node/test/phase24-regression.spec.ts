import 'reflect-metadata';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { UsersService } from '../src/users/users.service';
import { createGlobalValidationPipe } from '../src/validation/create-validation-pipe';
import { prepareTestDatabase } from './helpers/test-db';

describe('Phase 2.4 regression', () => {
  let app: INestApplication;
  let dataDir: string;
  let prisma: PrismaService;
  let users: UsersService;
  let accessToken = '';
  let refreshToken = '';
  const password = 'NewStrong!Pass1';

  beforeAll(async () => {
    const prepared = prepareTestDatabase('juman-p24-');
    dataDir = prepared.dataDir;
    process.env.IDENTITY_BOOTSTRAP_USERNAME = 'admin';
    process.env.IDENTITY_BOOTSTRAP_PASSWORD = 'Juman!Bootstrap1';
    process.env.MAX_FAILED_LOGIN_ATTEMPTS = '3';
    process.env.ACCOUNT_LOCK_DURATION_MINUTES = '15';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    users = app.get(UsersService);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Juman!Bootstrap1' })
      .expect(200);
    accessToken = login.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Juman!Bootstrap1', newPassword: password })
      .expect(200);

    const again = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password, rememberMe: true })
      .expect(200);
    accessToken = again.body.accessToken;
    refreshToken = again.body.refreshToken;
  }, 180_000);

  afterAll(async () => {
    if (app) await app.close();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });


  it('session restore rotates refresh token', async () => {
    const restored = await request(app.getHttpServer())
      .get('/auth/session')
      .set('X-Refresh-Token', refreshToken)
      .expect(200);
    expect(restored.body.tokens.accessToken).toBeTruthy();
    expect(restored.body.tokens.refreshToken).toBeTruthy();
    expect(restored.body.tokens.refreshToken).not.toBe(refreshToken);
    accessToken = restored.body.tokens.accessToken;
    refreshToken = restored.body.tokens.refreshToken;
  });

  it('concurrent refresh rotation leaves one valid chain', async () => {
    const token = refreshToken;
    const [a, b] = await Promise.allSettled([
      request(app.getHttpServer()).get('/auth/session').set('X-Refresh-Token', token),
      request(app.getHttpServer()).get('/auth/session').set('X-Refresh-Token', token),
    ]);

    const successes = [a, b].filter(
      (r) => r.status === 'fulfilled' && r.value.status === 200,
    );
    const failures = [a, b].filter(
      (r) =>
        r.status === 'fulfilled' && r.value.status >= 400,
    );

    expect(successes.length + failures.length).toBe(2);
    expect(successes.length).toBeLessThanOrEqual(1);

    if (successes.length === 1 && successes[0].status === 'fulfilled') {
      refreshToken = successes[0].value.body.tokens.refreshToken;
      accessToken = successes[0].value.body.tokens.accessToken;
    } else {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password, rememberMe: true })
        .expect(200);
      accessToken = login.body.accessToken;
      refreshToken = login.body.refreshToken;
    }

    const active = await prisma.refreshToken.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(active).toBeGreaterThanOrEqual(1);
  });

  it('disable account revokes sessions/refresh and rejects JWT', async () => {
    const admin = await users.findByUsername('admin');
    expect(admin).toBeTruthy();

    await users.disableAccount(admin!.id);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/auth/session')
      .set('X-Refresh-Token', refreshToken)
      .expect(401);

    const sessions = await prisma.loginSession.count({
      where: { userId: admin!.id, revokedAt: null },
    });
    const refresh = await prisma.refreshToken.count({
      where: { userId: admin!.id, revokedAt: null },
    });
    expect(sessions).toBe(0);
    expect(refresh).toBe(0);

    await users.enableAccount(admin!.id);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password, rememberMe: true })
      .expect(200);
    accessToken = login.body.accessToken;
    refreshToken = login.body.refreshToken;
  });

  it('timed lockout then admin unlock recovers access', async () => {
    const admin = await users.findByUsername('admin');
    expect(admin).toBeTruthy();
    await users.createUser({
      username: 'locktarget',
      password: 'Target!Pass123',
      fullName: 'Lock Target',
      roleId: admin!.roleId,
      mustChangePassword: false,
      isActive: true,
    });

    for (const pwd of ['bad1', 'bad2', 'bad3']) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'locktarget', password: pwd })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'locktarget', password: 'Target!Pass123' })
      .expect(401);

    const locked = await users.findByUsername('locktarget');
    expect(locked?.isLocked).toBe(true);
    expect(locked?.lockedUntil).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/admin/unlock')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: 'locktarget' })
      .expect(200);

    const unlocked = await users.findByUsername('locktarget');
    expect(unlocked?.isLocked).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'locktarget', password: 'Target!Pass123' })
      .expect(200);
  });

  it('unknown username still burns Argon2 time (dummy verify)', async () => {
    const start = Date.now();
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'definitely-missing-user', password: 'Whatever!12345' })
      .expect(401);
    const elapsed = Date.now() - start;
    // Argon2id with configured costs should not be near-instant.
    expect(elapsed).toBeGreaterThan(20);
  });
});