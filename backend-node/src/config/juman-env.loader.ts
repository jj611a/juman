import { existsSync, writeFileSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import {
  DEFAULT_APP_VERSION,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
} from '../core/constants';
import type { RuntimePaths } from '../shared/types';
import { toSqliteFileUrl } from './paths';

function buildDefaultEnvContents(paths: RuntimePaths): string {
  const root = paths.configDir.replace(/[/\\]config$/, '');
  return (
    [
      'APP_NAME=Juman',
      `APP_ENV=${DEFAULT_ENVIRONMENT}`,
      `APP_VERSION=${DEFAULT_APP_VERSION}`,
      `PORT=${DEFAULT_PORT}`,
      `LOG_LEVEL=${DEFAULT_LOG_LEVEL}`,
      `DATABASE_URL=${toSqliteFileUrl(paths.sqlitePath)}`,
      `JUMAN_DATA_DIR=${root.replaceAll('\\', '/')}`,
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
  process.env.PORT ??= String(DEFAULT_PORT);
  process.env.APP_VERSION ??= DEFAULT_APP_VERSION;
  process.env.APP_ENV ??= DEFAULT_ENVIRONMENT;
  process.env.LOG_LEVEL ??= DEFAULT_LOG_LEVEL;

  return { created, path: paths.jumanEnvPath };
}
