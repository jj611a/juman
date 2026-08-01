import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { configuration } from '../src/config/configuration';
import { validateEnvironment } from '../src/config/env.validation';

describe('configuration', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('loads typed defaults', () => {
    process.env.JUMAN_DATA_DIR = process.cwd();
    delete process.env.PORT;
    delete process.env.APP_VERSION;
    delete process.env.APP_ENV;
    const cfg = configuration().app;
    expect(cfg.port).toBe(8787);
    expect(cfg.version).toBe('2.0.0');
    expect(cfg.environment).toBe('development');
    expect(cfg.databaseUrl.startsWith('file:')).toBe(true);
  });

  it('rejects invalid PORT as critical', () => {
    process.env.JUMAN_DATA_DIR = process.cwd();
    process.env.PORT = 'not-a-port';
    expect(() => configuration()).toThrow(/Critical configuration error/);
  });

  it('validates environment whitelist fields', () => {
    expect(() =>
      validateEnvironment({ PORT: 8787, APP_ENV: 'development' }),
    ).not.toThrow();
  });
});
