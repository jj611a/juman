import {
  APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_HOST,
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
  PASSWORD_MIN_LENGTH_FLOOR,
} from '../core/auth.constants';
import type { AppConfig, AppEnvironmentName, AuthConfig } from '../shared/types';
import { buildRuntimePaths, resolveDataRoot, toSqliteFileUrl } from './paths';

function parsePort(raw: string | undefined): number {
  if (!raw) return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Critical configuration error: invalid PORT=${raw}`);
  }
  return n;
}

function parseEnvironment(raw: string | undefined): AppEnvironmentName {
  if (raw === 'production' || raw === 'test' || raw === 'development') return raw;
  return DEFAULT_ENVIRONMENT;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Critical configuration error: invalid integer ${raw}`);
  }
  return n;
}

function parseStrictPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Critical configuration error: invalid positive integer ${raw}`);
  }
  return n;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`Critical configuration error: invalid boolean ${raw}`);
}

function resolveJwtSecret(environment: AppEnvironmentName): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (environment === 'production') {
    throw new Error(
      'Critical configuration error: JWT_SECRET is required in production (min 32 chars)',
    );
  }
  if (secret && secret.length > 0 && secret.length < 32) {
    throw new Error('Critical configuration error: JWT_SECRET must be at least 32 characters');
  }
  // Deterministic non-production fallback only when unset (tests / first boot before env write).
  return 'juman-dev-only-jwt-secret-do-not-use-in-production!!';
}

function buildAuthConfig(environment: AppEnvironmentName): AuthConfig {
  const passwordMinLength = Math.max(
    PASSWORD_MIN_LENGTH_FLOOR,
    parseStrictPositiveInt(process.env.PASSWORD_MIN_LENGTH, DEFAULT_PASSWORD_MIN_LENGTH),
  );

  return {
    jwtSecret: resolveJwtSecret(environment),
    jwtIssuer: process.env.JWT_ISSUER ?? DEFAULT_JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
    accessTokenExpireMinutes: parseStrictPositiveInt(
      process.env.ACCESS_TOKEN_EXPIRE_MINUTES,
      DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
    ),
    refreshTokenExpireDays: parseStrictPositiveInt(
      process.env.REFRESH_TOKEN_EXPIRE_DAYS,
      DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS,
    ),
    rememberMeRefreshTokenExpireDays: parseStrictPositiveInt(
      process.env.REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
      DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS,
    ),
    argon2: {
      timeCost: parseStrictPositiveInt(process.env.ARGON2_TIME_COST, DEFAULT_ARGON2_TIME_COST),
      memoryCost: parseStrictPositiveInt(
        process.env.ARGON2_MEMORY_COST,
        DEFAULT_ARGON2_MEMORY_COST,
      ),
      parallelism: parseStrictPositiveInt(
        process.env.ARGON2_PARALLELISM,
        DEFAULT_ARGON2_PARALLELISM,
      ),
    },
    maxFailedLoginAttempts: parseStrictPositiveInt(
      process.env.MAX_FAILED_LOGIN_ATTEMPTS,
      DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
    ),
    accountLockDurationMinutes: parsePositiveInt(
      process.env.ACCOUNT_LOCK_DURATION_MINUTES,
      DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES,
    ),
    passwordMinLength,
    passwordRequireComplexity: parseBoolean(process.env.PASSWORD_REQUIRE_COMPLEXITY, true),
    passwordHistoryCount: parsePositiveInt(
      process.env.PASSWORD_HISTORY_COUNT,
      DEFAULT_PASSWORD_HISTORY_COUNT,
    ),
  };
}

export function configuration(): { app: AppConfig } {
  const jumanDataDir = resolveDataRoot();
  const paths = buildRuntimePaths(jumanDataDir);
  const databaseUrl = process.env.DATABASE_URL ?? toSqliteFileUrl(paths.sqlitePath);

  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Critical configuration error: DATABASE_URL must be a SQLite file: URL');
  }

  const environment = parseEnvironment(process.env.APP_ENV);

  const app: AppConfig = {
    name: process.env.APP_NAME ?? APP_NAME,
    version: process.env.APP_VERSION ?? DEFAULT_APP_VERSION,
    environment,
    host: (process.env.HOST?.trim() || DEFAULT_HOST),
    port: parsePort(process.env.PORT),
    logLevel: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
    jumanDataDir,
    databaseUrl,
    paths,
    auth: buildAuthConfig(environment),
  };

  return { app };
}
