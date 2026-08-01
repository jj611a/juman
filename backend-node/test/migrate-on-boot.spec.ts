import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPendingMigrations } from '../src/database/migrate-on-boot';
import { buildRuntimePaths } from '../src/config/paths';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';

describe('migrate-on-boot', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('applies migrations on a fresh sqlite file', () => {
    root = mkdtempSync(join(tmpdir(), 'juman-migrate-'));
    const paths = buildRuntimePaths(root);
    ensureRuntimeDirectories(paths);
    const dbUrl = `file:${join(paths.dataDir, 'fresh.db').replaceAll('\\', '/')}`;
    const result = runPendingMigrations(dbUrl);
    expect(result.ok).toBe(true);
    // idempotent re-apply while no Nest connection holds the file
    const again = runPendingMigrations(dbUrl);
    expect(again.ok).toBe(true);
  }, 120_000);

  it('rejects non-sqlite database urls', () => {
    expect(() => runPendingMigrations('postgresql://localhost/db')).toThrow(/SQLite/);
  });
});