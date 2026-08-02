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
  TRANSITION: 'inventory.transition',
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

/** Operational lifecycle (Phase 4.2) — separate from catalog ITEM_STATUS. */
export const ITEM_LIFECYCLE = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  RENTED: 'rented',
  RETURN_PENDING: 'return_pending',
  INSPECTION: 'inspection',
  CLEANING: 'cleaning',
  MAINTENANCE: 'maintenance',
  FOR_SALE: 'for_sale',
  SOLD: 'sold',
  RETIRED: 'retired',
  LOST: 'lost',
  DAMAGED: 'damaged',
} as const;

export type ItemLifecycleState =
  (typeof ITEM_LIFECYCLE)[keyof typeof ITEM_LIFECYCLE];

export const ITEM_LIFECYCLE_VALUES = Object.values(ITEM_LIFECYCLE);

export const ITEM_LIFECYCLE_DEFAULT = ITEM_LIFECYCLE.AVAILABLE;

/**
 * Allowed transitions. Future modules MUST use LifecycleService —
 * never invent parallel state machines.
 */
export const ITEM_LIFECYCLE_TRANSITIONS: Readonly<
  Record<ItemLifecycleState, readonly ItemLifecycleState[]>
> = {
  [ITEM_LIFECYCLE.AVAILABLE]: [
    ITEM_LIFECYCLE.RESERVED,
    ITEM_LIFECYCLE.FOR_SALE,
    ITEM_LIFECYCLE.MAINTENANCE,
    ITEM_LIFECYCLE.RETIRED,
    ITEM_LIFECYCLE.LOST,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.RESERVED]: [
    ITEM_LIFECYCLE.AVAILABLE,
    ITEM_LIFECYCLE.RENTED,
    ITEM_LIFECYCLE.LOST,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.RENTED]: [
    ITEM_LIFECYCLE.RETURN_PENDING,
    ITEM_LIFECYCLE.LOST,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.RETURN_PENDING]: [
    ITEM_LIFECYCLE.INSPECTION,
    ITEM_LIFECYCLE.LOST,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.INSPECTION]: [
    ITEM_LIFECYCLE.CLEANING,
    ITEM_LIFECYCLE.MAINTENANCE,
    ITEM_LIFECYCLE.AVAILABLE,
    ITEM_LIFECYCLE.DAMAGED,
    ITEM_LIFECYCLE.RETIRED,
  ],
  [ITEM_LIFECYCLE.CLEANING]: [
    ITEM_LIFECYCLE.AVAILABLE,
    ITEM_LIFECYCLE.MAINTENANCE,
  ],
  [ITEM_LIFECYCLE.MAINTENANCE]: [
    ITEM_LIFECYCLE.AVAILABLE,
    ITEM_LIFECYCLE.RETIRED,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.FOR_SALE]: [
    ITEM_LIFECYCLE.AVAILABLE,
    ITEM_LIFECYCLE.SOLD,
    ITEM_LIFECYCLE.RETIRED,
    ITEM_LIFECYCLE.LOST,
    ITEM_LIFECYCLE.DAMAGED,
  ],
  [ITEM_LIFECYCLE.SOLD]: [ITEM_LIFECYCLE.RETIRED],
  [ITEM_LIFECYCLE.RETIRED]: [],
  [ITEM_LIFECYCLE.LOST]: [ITEM_LIFECYCLE.AVAILABLE, ITEM_LIFECYCLE.RETIRED],
  [ITEM_LIFECYCLE.DAMAGED]: [
    ITEM_LIFECYCLE.MAINTENANCE,
    ITEM_LIFECYCLE.RETIRED,
  ],
};

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
