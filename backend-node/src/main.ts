import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadOrCreateJumanEnv } from './config/juman-env.loader';
import { buildRuntimePaths, resolveDataRoot, toSqliteFileUrl } from './config/paths';
import { runPendingMigrations } from './database/migrate-on-boot';
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

  const databaseUrl = process.env.DATABASE_URL ?? toSqliteFileUrl(paths.sqlitePath);
  try {
    runPendingMigrations(databaseUrl);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal startup error (migrations): ${message}`);
    process.exit(1);
  }

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
    host: appConfig.host,
    port: appConfig.port,
    dataDir: appConfig.jumanDataDir,
    envFile: envLoad.path,
    envCreated: envLoad.created,
    migrations: 'applied',
  });

  await app.listen(appConfig.port, appConfig.host);

  logger.startup(`Listening on http://${appConfig.host}:${appConfig.port}`);
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

