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

export interface Argon2Config {
  readonly timeCost: number;
  readonly memoryCost: number;
  readonly parallelism: number;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly accessTokenExpireMinutes: number;
  readonly refreshTokenExpireDays: number;
  readonly rememberMeRefreshTokenExpireDays: number;
  readonly argon2: Argon2Config;
  readonly maxFailedLoginAttempts: number;
  readonly accountLockDurationMinutes: number;
  readonly loginRateLimitWindowMs: number;
  readonly loginRateLimitMaxPerIp: number;
  readonly loginRateLimitMaxPerUsername: number;
  readonly passwordMinLength: number;
  readonly passwordRequireComplexity: boolean;
  readonly passwordHistoryCount: number;
}

export interface AppConfig {
  readonly name: string;
  readonly version: string;
  readonly environment: AppEnvironmentName;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly jumanDataDir: string;
  readonly databaseUrl: string;
  readonly paths: RuntimePaths;
  readonly auth: AuthConfig;
}

export interface AccessTokenClaims {
  readonly sub: string;
  readonly sid: string;
  readonly type: 'access';
  readonly iss: string;
  readonly aud: string;
  readonly iat: number;
  readonly exp: number;
}

export interface AuthPrincipal {
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly sessionId: string;
  readonly permissions: readonly string[];
  readonly mustChangePassword: boolean;
  readonly isActive: boolean;
}
