export const USER_PERMISSION = {
  VIEW: 'users.view',
  CREATE: 'users.create',
  UPDATE: 'users.update',
  DELETE: 'users.delete',
  MANAGE: 'users.manage',
  UNLOCK: 'users.unlock',
  VIEW_LOGIN_HISTORY: 'users.view_login_history',
} as const;

export const USER_MODULE = 'users';
export const USER_ENTITY = 'user';

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LOCKED: 'locked',
} as const;

export const USER_SORT_FIELDS = [
  'username',
  'fullName',
  'createdAt',
  'updatedAt',
  'lastLoginAt',
] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const USER_NAME_MAX = 120;
export const USER_USERNAME_MAX = 64;
export const USER_USERNAME_MIN = 2;