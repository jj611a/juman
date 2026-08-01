import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRuntimePaths } from '../../src/config/paths';
import { ensureRuntimeDirectories } from '../../src/storage/ensure-dirs';

export function prepareTestDatabase(prefix = 'juman-test-'): {
  dataDir: string;
  dbUrl: string;
} {
  const dataDir = mkdtempSync(join(tmpdir(), prefix));
  const paths = buildRuntimePaths(dataDir);
  ensureRuntimeDirectories(paths);
  const dbUrl = `file:${join(paths.dataDir, 'juman.db').replaceAll('\\', '/')}`;

  process.env.VITEST = 'true';
  process.env.APP_ENV = 'test';
  process.env.JUMAN_DATA_DIR = dataDir;
  process.env.DATABASE_URL = dbUrl;
  process.env.JWT_SECRET = 'juman-test-jwt-secret-with-enough-length!!';
  process.env.HOST = '127.0.0.1';

  execSync('pnpm exec prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  return { dataDir, dbUrl };
}