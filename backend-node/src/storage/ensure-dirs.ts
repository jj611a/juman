import { mkdirSync } from 'node:fs';
import type { RuntimePaths } from '../shared/types';

export function ensureRuntimeDirectories(paths: RuntimePaths): void {
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.storageDir, { recursive: true });
  mkdirSync(paths.configDir, { recursive: true });
}
