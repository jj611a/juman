import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRuntimePaths, toSqliteFileUrl } from '../src/config/paths';

describe('runtime paths', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('builds data/logs/storage/config and sqlite path', () => {
    const root = mkdtempSync(join(tmpdir(), 'juman-paths-'));
    dirs.push(root);
    const paths = buildRuntimePaths(root);
    expect(paths.dataDir).toContain('data');
    expect(paths.logsDir).toContain('logs');
    expect(paths.storageDir).toContain('storage');
    expect(paths.configDir).toContain('config');
    expect(paths.sqlitePath.endsWith('juman.db')).toBe(true);
    expect(toSqliteFileUrl(paths.sqlitePath).startsWith('file:')).toBe(true);
  });
});
