import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRuntimePaths } from '../src/config/paths';
import { AppLoggerService } from '../src/logging/app-logger.service';
import { ensureRuntimeDirectories } from '../src/storage/ensure-dirs';

describe('AppLoggerService', () => {
  let root = '';
  const original = process.env.JUMAN_DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.JUMAN_DATA_DIR;
    else process.env.JUMAN_DATA_DIR = original;
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('logs without throwing and closes cleanly', () => {
    root = mkdtempSync(join(tmpdir(), 'juman-log-'));
    process.env.JUMAN_DATA_DIR = root;
    ensureRuntimeDirectories(buildRuntimePaths(root));
    const logger = new AppLoggerService();
    expect(() => logger.startup('boot')).not.toThrow();
    expect(() => logger.log('hello', 'Test')).not.toThrow();
    expect(() => logger.error('boom', 'stack', 'Test')).not.toThrow();
    expect(() => logger.request('GET /health', { status: 200 })).not.toThrow();
    expect(() => logger.onModuleDestroy()).not.toThrow();
  });
});
