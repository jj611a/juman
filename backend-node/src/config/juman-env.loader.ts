import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import {
  DEFAULT_APP_VERSION,
  DEFAULT_ENVIRONMENT,
  DEFAULT_HOST,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
} from '../core/constants';
import {
  DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
  DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES,
  DEFAULT_ARGON2_MEMORY_COST,
  DEFAULT_ARGON2_PARALLELISM,
  DEFAULT_ARGON2_TIME_COST,
  DEFAULT_JWT_AUDIENCE,
  DEFAULT_JWT_ISSUER,
  DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
  DEFAULT_PASSWORD_HISTORY_COUNT,
  DEFAULT_PASSWORD_MIN_LENGTH,
  DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS,
  DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
} from '../core/auth.constants';
import type { RuntimePaths } from '../shared/types';
import { toSqliteFileUrl } from './paths';

function buildDefaultEnvContents(paths: RuntimePaths): string {
  const root = paths.configDir.replace(/[/\\]config$/, '');
  const jwtSecret = randomBytes(48).toString('hex');
  return (
    [
      'APP_NAME=Juman',
      `APP_ENV=${DEFAULT_ENVIRONMENT}`,
      `APP_VERSION=${DEFAULT_APP_VERSION}`,
      `HOST=${DEFAULT_HOST}`,
      `PORT=${DEFAULT_PORT}`,
      `LOG_LEVEL=${DEFAULT_LOG_LEVEL}`,
      `DATABASE_URL=${toSqliteFileUrl(paths.sqlitePath)}`,
      `JUMAN_DATA_DIR=${root.replaceAll('\\', '/')}`,
      `JWT_SECRET=${jwtSecret}`,
      `JWT_ISSUER=${DEFAULT_JWT_ISSUER}`,
      `JWT_AUDIENCE=${DEFAULT_JWT_AUDIENCE}`,
      `ACCESS_TOKEN_EXPIRE_MINUTES=${DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES}`,
      `REFRESH_TOKEN_EXPIRE_DAYS=${DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS}`,
      `REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS=${DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS}`,
      `ARGON2_TIME_COST=${DEFAULT_ARGON2_TIME_COST}`,
      `ARGON2_MEMORY_COST=${DEFAULT_ARGON2_MEMORY_COST}`,
      `ARGON2_PARALLELISM=${DEFAULT_ARGON2_PARALLELISM}`,
      `MAX_FAILED_LOGIN_ATTEMPTS=${DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS}`,
      `ACCOUNT_LOCK_DURATION_MINUTES=${DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES}`,
      `PASSWORD_MIN_LENGTH=${DEFAULT_PASSWORD_MIN_LENGTH}`,
      'PASSWORD_REQUIRE_COMPLEXITY=true',
      `PASSWORD_HISTORY_COUNT=${DEFAULT_PASSWORD_HISTORY_COUNT}`,
    ].join('\n') + '\n'
  );
}

/** Ensure config/juman.env exists (generate safe defaults) and load into process.env. */
export function loadOrCreateJumanEnv(paths: RuntimePaths): { created: boolean; path: string } {
  let created = false;
  if (!existsSync(paths.jumanEnvPath)) {
    writeFileSync(paths.jumanEnvPath, buildDefaultEnvContents(paths), { encoding: 'utf8' });
    created = true;
  }

  loadDotenv({ path: paths.jumanEnvPath, override: false });

  const root = paths.configDir.replace(/[/\\]config$/, '');
  process.env.JUMAN_DATA_DIR ??= root;
  process.env.DATABASE_URL ??= toSqliteFileUrl(paths.sqlitePath);
  process.env.HOST ??= DEFAULT_HOST;
  process.env.PORT ??= String(DEFAULT_PORT);
  process.env.APP_VERSION ??= DEFAULT_APP_VERSION;
  process.env.APP_ENV ??= DEFAULT_ENVIRONMENT;
  process.env.LOG_LEVEL ??= DEFAULT_LOG_LEVEL;
  process.env.JWT_ISSUER ??= DEFAULT_JWT_ISSUER;
  process.env.JWT_AUDIENCE ??= DEFAULT_JWT_AUDIENCE;

  return { created, path: paths.jumanEnvPath };
}
