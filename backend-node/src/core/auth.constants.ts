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
export const DEFAULT_ACCOUNT_LOCK_DURATION_MINUTES = 0;
export const DEFAULT_PASSWORD_MIN_LENGTH = 10;
export const DEFAULT_PASSWORD_MAX_LENGTH = 128;
export const DEFAULT_PASSWORD_HISTORY_COUNT = 5;
export const PASSWORD_MIN_LENGTH_FLOOR = 8;

export const AUTH_API_PREFIX = 'api/v1';

export const LOGIN_HISTORY_EVENT = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  ACCOUNT_LOCKED: 'account_locked',
  PASSWORD_RESET: 'password_reset',
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

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';
export const REQUIRED_PERMISSIONS_MODE_KEY = 'auth:requiredPermissionsMode';

export const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/logout',
  '/api/v1/auth/logout-all',
  '/api/v1/auth/me',
  '/api/v1/auth/sessions',
] as const;
