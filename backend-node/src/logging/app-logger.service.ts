import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { buildRuntimePaths, resolveDataRoot } from '../config/paths';
import { LOG_CHANNEL, type LogChannel } from '../core/constants';
import { ensureRuntimeDirectories } from '../storage/ensure-dirs';

@Injectable()
export class AppLoggerService implements LoggerService, OnModuleDestroy {
  private readonly logger: WinstonLogger;
  private closed = false;

  constructor() {
    const paths = buildRuntimePaths(resolveDataRoot());
    ensureRuntimeDirectories(paths);

    const jsonFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json(),
    );

    const consoleTransport = new transports.Console({
      silent: process.env.VITEST === 'true',
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message, context, channel, ...meta }) => {
          const ctx = typeof context === 'string' ? context : 'App';
          const ch = typeof channel === 'string' ? channel : LOG_CHANNEL.APPLICATION;
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} [${ch}] [${ctx}] ${level}: ${String(message)}${rest}`;
        }),
      ),
    });

    const fileTransports =
      process.env.VITEST === 'true'
        ? []
        : [
            this.rotate(paths.logsDir, LOG_CHANNEL.APPLICATION, jsonFormat),
            this.rotate(paths.logsDir, LOG_CHANNEL.ERRORS, jsonFormat, 'error'),
            this.rotate(paths.logsDir, LOG_CHANNEL.STARTUP, jsonFormat),
            this.rotate(paths.logsDir, LOG_CHANNEL.REQUESTS, jsonFormat),
          ];

    this.logger = createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      defaultMeta: { service: 'juman-backend-node' },
      transports: [consoleTransport, ...fileTransports],
    });
  }

  log(message: unknown, context?: string): void {
    this.write('info', LOG_CHANNEL.APPLICATION, message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', LOG_CHANNEL.ERRORS, message, context, trace ? { trace } : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', LOG_CHANNEL.APPLICATION, message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', LOG_CHANNEL.APPLICATION, message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', LOG_CHANNEL.APPLICATION, message, context);
  }

  startup(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { channel: LOG_CHANNEL.STARTUP, context: 'Startup', ...meta });
  }

  request(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { channel: LOG_CHANNEL.REQUESTS, context: 'HTTP', ...meta });
  }

  onModuleDestroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.logger.close();
  }

  private rotate(
    dirname: string,
    channel: LogChannel,
    jsonFormat: ReturnType<typeof format.combine>,
    level?: string,
  ): DailyRotateFile {
    return new DailyRotateFile({
      dirname,
      filename: `${channel}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '30d',
      level,
      format: jsonFormat,
    });
  }

  private write(
    level: 'info' | 'error' | 'warn' | 'debug' | 'verbose',
    channel: LogChannel,
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    this.logger.log(level, text, {
      channel,
      context: context ?? 'App',
      ...extra,
    });
  }
}
