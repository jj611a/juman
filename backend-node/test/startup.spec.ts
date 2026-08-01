import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadOrCreateJumanEnv } from '../src/config/juman-env.loader';
import { buildRuntimePaths } from '../src/config/paths';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';

describe('startup sequence', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('prepares dirs and env before Nest boot', () => {
    root = mkdtempSync(join(tmpdir(), 'juman-start-'));
    const paths = buildRuntimePaths(root);
    ensureRuntimeDirectories(paths);
    const env = loadOrCreateJumanEnv(paths);
    expect(env.created).toBe(true);
    expect(existsSync(paths.jumanEnvPath)).toBe(true);
    expect(existsSync(paths.dataDir)).toBe(true);
    expect(process.env.DATABASE_URL?.startsWith('file:')).toBe(true);
  });
});
