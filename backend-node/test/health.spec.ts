import { describe, expect, it, vi } from 'vitest';
import { HealthService } from '../src/health/health.service';

describe('HealthService', () => {
  it('reports connected database', async () => {
    const service = new HealthService(
      {
        getOrThrow: vi.fn().mockReturnValue({
          version: '2.0.0',
          environment: 'development',
        }),
      } as never,
      { verifyConnection: vi.fn().mockResolvedValue(true) } as never,
    );

    await expect(service.getHealth()).resolves.toMatchObject({
      status: 'ok',
      version: '2.0.0',
      database: 'connected',
      environment: 'development',
    });
  });

  it('reports disconnected database as degraded', async () => {
    const service = new HealthService(
      {
        getOrThrow: vi.fn().mockReturnValue({
          version: '2.0.0',
          environment: 'development',
        }),
      } as never,
      { verifyConnection: vi.fn().mockResolvedValue(false) } as never,
    );

    await expect(service.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      database: 'disconnected',
    });
  });
});
