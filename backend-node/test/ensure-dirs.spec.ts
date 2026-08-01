import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRuntimePaths } from '../src/config/paths';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';

describe('database / directory initialization', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('creates data logs storage config on demand', () => {
    root = mkdtempSync(join(tmpdir(), 'juman-dirs-'));
    const paths = buildRuntimePaths(root);
    ensureRuntimeDirectories(paths);
    expect(existsSync(paths.dataDir)).toBe(true);
    expect(existsSync(paths.logsDir)).toBe(true);
    expect(existsSync(paths.storageDir)).toBe(true);
    expect(existsSync(paths.configDir)).toBe(true);
  });
});
