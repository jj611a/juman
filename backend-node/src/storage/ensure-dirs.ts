import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RuntimePaths } from '../shared/types';

const STORAGE_CATEGORIES = [
  'images',
  'documents',
  'temp',
  'thumbnails',
  'imports',
  'exports',
] as const;

export function ensureRuntimeDirectories(paths: RuntimePaths): void {
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.storageDir, { recursive: true });
  mkdirSync(paths.configDir, { recursive: true });
  for (const category of STORAGE_CATEGORIES) {
    mkdirSync(resolve(paths.storageDir, category), { recursive: true });
  }
}
