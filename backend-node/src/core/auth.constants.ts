export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_TOKEN_TYPE_ACCESS = 'access' as const;

export const DEFAULT_JWT_ISSUER = 'juman';
export const DEFAULT_JWT_AUDIENCE = 'juman-desktop';
export const DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 60;
export const DEFAULT_REFRESH_TOKEN_EXPIRE_DAYS = 7;
export const DEFAULT_REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS = 30;

export const DEFAULT_ARGON2_TIME_COST = 3;
export const DEFAULT_ARGON2_MEMORY_COST = 65536;
export const DEFAULT_ARGON2_PARALLELISM = 1;

export const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES = 15;
export const DEFAULT_PASSWORD_MIN_LENGTH = 10;
export const DEFAULT_PASSWORD_MAX_LENGTH = 128;
export const DEFAULT_PASSWORD_HISTORY_COUNT = 5;
export const PASSWORD_MIN_LENGTH_FLOOR = 8;

/** Public auth route prefix (Electron Main client). */
export const AUTH_API_PREFIX = 'auth';

export const AUDIT_EVENT = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
} as const;

export const LOGIN_FAILURE_REASON = {
  USER_NOT_FOUND: 'user_not_found',
  INACTIVE: 'inactive',
  LOCKED: 'locked',
  BAD_PASSWORD: 'bad_password',
  DELETED: 'deleted',
} as const;

export const SYSTEM_ROLE = {
  ADMIN: 'Admin',
  CASHIER: 'Cashier',
  INVENTORY: 'Inventory',
  LAUNDRY: 'Laundry',
} as const;

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_FULL_NAME = 'Administrator';

export const ACCOUNT_UNLOCK_PERMISSION = 'users.unlock';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';
export const REQUIRED_PERMISSIONS_MODE_KEY = 'auth:requiredPermissionsMode';

/** Paths allowed while mustChangePassword is true. */
export const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/auth/session',
] as const;
