export const INVENTORY_MODULE = 'inventory';
export const ITEM_ENTITY = 'item';
export const TAXONOMY_ENTITY = {
  CATEGORY: 'category',
  BRAND: 'brand',
  COLOR: 'color',
  SIZE: 'size',
} as const;
export const INVENTORY_PERMISSION = {
  VIEW: 'inventory.view',
  CREATE: 'inventory.create',
  UPDATE: 'inventory.update',
  DELETE: 'inventory.delete',
  RESTORE: 'inventory.restore',
} as const;
export const CATEGORY_PERMISSION = {
  VIEW: 'categories.view',
  CREATE: 'categories.create',
  UPDATE: 'categories.update',
  DELETE: 'categories.delete',
  RESTORE: 'categories.restore',
} as const;
export const ITEM_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  RETIRED: 'retired',
} as const;
export const ITEM_CONDITION = {
  NEW: 'new',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  UNKNOWN: 'unknown',
} as const;
export const ITEM_SORT_FIELDS = [
  'displayName',
  'internalCode',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export const INVENTORY_ITEM_SETTING = {
  PREFIX: 'inventory.item.prefix',
  SEPARATOR: 'inventory.item.separator',
  PADDING: 'inventory.item.padding',
} as const;
export const ITEM_DEFAULT_PREFIX = 'ITM';
export const ITEM_DEFAULT_SEPARATOR = '-';
export const ITEM_DEFAULT_PADDING = 8;
