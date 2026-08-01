import { resolve } from 'node:path';
import {
  JUMAN_ENV_FILENAME,
  SQLITE_FILENAME,
} from '../core/constants';
import type { RuntimePaths } from '../shared/types';

export function resolveDataRoot(): string {
  if (process.env.JUMAN_DATA_DIR && process.env.JUMAN_DATA_DIR.trim().length > 0) {
    return resolve(process.env.JUMAN_DATA_DIR.trim());
  }
  // Monorepo default: repo root when cwd is backend-node
  return resolve(process.cwd(), '..');
}

export function buildRuntimePaths(jumanDataDir: string): RuntimePaths {
  const root = resolve(jumanDataDir);
  const dataDir = resolve(root, 'data');
  return {
    dataDir,
    logsDir: resolve(root, 'logs'),
    storageDir: resolve(root, 'storage'),
    configDir: resolve(root, 'config'),
    sqlitePath: resolve(dataDir, SQLITE_FILENAME),
    jumanEnvPath: resolve(root, 'config', JUMAN_ENV_FILENAME),
  };
}

export function toSqliteFileUrl(sqlitePath: string): string {
  return `file:${sqlitePath.replaceAll('\\', '/')}`;
}
