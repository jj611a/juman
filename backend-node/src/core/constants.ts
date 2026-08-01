export const APP_NAME = 'Juman';
export const DEFAULT_PORT = 8787;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_APP_VERSION = '2.0.0';
export const DEFAULT_ENVIRONMENT = 'development';
export const DEFAULT_LOG_LEVEL = 'info';

export const RUNTIME_DIR_NAMES = ['data', 'logs', 'storage', 'config'] as const;

export const JUMAN_ENV_FILENAME = 'juman.env';
export const SQLITE_FILENAME = 'juman.db';

export const LOG_CHANNEL = {
  APPLICATION: 'application',
  ERRORS: 'errors',
  STARTUP: 'startup',
  REQUESTS: 'requests',
} as const;

export type LogChannel = (typeof LOG_CHANNEL)[keyof typeof LOG_CHANNEL];
