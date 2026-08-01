import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/database/prisma.service';
import { AppLoggerService } from '../src/logging/app-logger.service';

describe('shutdown hooks', () => {
  it('disconnects prisma and closes logger', async () => {
    const logger = {
      startup: vi.fn(),
      onModuleDestroy: vi.fn(),
    };
    const prisma = Object.create(PrismaService.prototype) as PrismaService;
    Object.assign(prisma, {
      logger,
      $disconnect: vi.fn().mockResolvedValue(undefined),
    });

    await prisma.onModuleDestroy();
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(logger.startup).toHaveBeenCalledWith('Prisma disconnected');

    const appLogger = Object.create(AppLoggerService.prototype) as AppLoggerService;
    Object.assign(appLogger, {
      closed: false,
      logger: { close: vi.fn() },
    });
    appLogger.onModuleDestroy();
    expect((appLogger as unknown as { logger: { close: ReturnType<typeof vi.fn> } }).logger.close).toHaveBeenCalled();
  });
});
