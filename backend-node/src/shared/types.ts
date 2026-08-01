export type AppEnvironmentName = 'development' | 'production' | 'test';

export type DatabaseHealthStatus = 'connected' | 'disconnected';

export type HealthStatus = 'ok' | 'degraded';

export interface RuntimePaths {
  readonly dataDir: string;
  readonly logsDir: string;
  readonly storageDir: string;
  readonly configDir: string;
  readonly sqlitePath: string;
  readonly jumanEnvPath: string;
}

export interface AppConfig {
  readonly name: string;
  readonly version: string;
  readonly environment: AppEnvironmentName;
  readonly port: number;
  readonly logLevel: string;
  readonly jumanDataDir: string;
  readonly databaseUrl: string;
  readonly paths: RuntimePaths;
}
