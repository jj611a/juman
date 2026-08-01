import {
  APP_NAME,
  DEFAULT_APP_VERSION,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
} from '../core/constants';
import type { AppConfig, AppEnvironmentName } from '../shared/types';
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

export function configuration(): { app: AppConfig } {
  const jumanDataDir = resolveDataRoot();
  const paths = buildRuntimePaths(jumanDataDir);
  const databaseUrl = process.env.DATABASE_URL ?? toSqliteFileUrl(paths.sqlitePath);

  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Critical configuration error: DATABASE_URL must be a SQLite file: URL');
  }

  const app: AppConfig = {
    name: process.env.APP_NAME ?? APP_NAME,
    version: process.env.APP_VERSION ?? DEFAULT_APP_VERSION,
    environment: parseEnvironment(process.env.APP_ENV),
    port: parsePort(process.env.PORT),
    logLevel: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
    jumanDataDir,
    databaseUrl,
    paths,
  };

  return { app };
}
