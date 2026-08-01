import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ensureRuntimeDirectories } from './bootstrap/ensure-dirs';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';
async function bootstrap(): Promise<void> { ensureRuntimeDirectories(); const app = await NestFactory.create(AppModule); app.useLogger(app.get(AppLoggerService)); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); app.useGlobalFilters(new HttpExceptionFilter()); app.enableShutdownHooks(); await app.listen(process.env.PORT ?? 8787); }
void bootstrap();
