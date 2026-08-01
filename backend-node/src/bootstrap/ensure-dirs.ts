import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
export function ensureRuntimeDirectories(): void {
  const root = resolve(process.env.JUMAN_DATA_DIR ?? resolve(process.cwd(), '..'));
  for (const name of ['data', 'logs', 'storage', 'config']) mkdirSync(resolve(root, name), { recursive: true });
  process.env.JUMAN_DATA_DIR = root;
  process.env.DATABASE_URL ??= `file:${resolve(root, 'data', 'juman.db').replaceAll('\\', '/')}`;
}
