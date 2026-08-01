import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadOrCreateJumanEnv } from './config/juman-env.loader';
import { buildRuntimePaths, resolveDataRoot } from './config/paths';
import { GlobalHttpExceptionFilter } from './exceptions/http-exception.filter';
import { registerProcessExceptionHandlers } from './exceptions/process-exception.handlers';
import { AppLoggerService } from './logging/app-logger.service';
import { ensureRuntimeDirectories } from './storage/ensure-dirs';
import { createGlobalValidationPipe } from './validation/create-validation-pipe';
import type { AppConfig } from './shared/types';

async function bootstrap(): Promise<void> {
  const jumanDataDir = resolveDataRoot();
  const paths = buildRuntimePaths(jumanDataDir);
  ensureRuntimeDirectories(paths);
  const envLoad = loadOrCreateJumanEnv(paths);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  registerProcessExceptionHandlers(logger);

  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new GlobalHttpExceptionFilter(logger));
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  logger.startup('Juman Backend V2 starting', {
    version: appConfig.version,
    environment: appConfig.environment,
    port: appConfig.port,
    dataDir: appConfig.jumanDataDir,
    envFile: envLoad.path,
    envCreated: envLoad.created,
  });

  await app.listen(appConfig.port);

  logger.startup(`Listening on http://127.0.0.1:${appConfig.port}`);
  logger.startup('GET /health ready');

  const shutdown = async (signal: string): Promise<void> => {
    logger.startup(`Graceful shutdown (${signal})`);
    await app.close();
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});
