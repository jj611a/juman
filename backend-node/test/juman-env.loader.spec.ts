import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadOrCreateJumanEnv } from '../src/config/juman-env.loader';
import { buildRuntimePaths } from '../src/config/paths';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';

describe('juman.env loader', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('generates config/juman.env when missing', () => {
    root = mkdtempSync(join(tmpdir(), 'juman-env-'));
    const paths = buildRuntimePaths(root);
    ensureRuntimeDirectories(paths);
    const result = loadOrCreateJumanEnv(paths);
    expect(result.created).toBe(true);
    expect(existsSync(paths.jumanEnvPath)).toBe(true);
    const body = readFileSync(paths.jumanEnvPath, 'utf8');
    expect(body).toContain('APP_VERSION=2.0.0');
    expect(body).toContain('DATABASE_URL=file:');
  });
});
