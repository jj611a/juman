import type { AppLoggerService } from '../logging/app-logger.service';

export function registerProcessExceptionHandlers(logger: AppLoggerService): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error(error.message, error.stack, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof Error) {
      logger.error(reason.message, reason.stack, 'unhandledRejection');
      return;
    }
    logger.error(String(reason), undefined, 'unhandledRejection');
  });
}
