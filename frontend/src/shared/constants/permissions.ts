/**
 * Nest permission keys used for navigation gating.
 * Source: docs/frontend/BACKEND_FEATURE_MAP.md — do not invent Nest keys.
 */
export const PERMISSION = {
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_RESTORE: 'customer.restore',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_DELETE: 'inventory.delete',
  INVENTORY_RESTORE: 'inventory.restore',
  INVENTORY_TRANSITION: 'inventory.transition',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  CATEGORIES_RESTORE: 'categories.restore',
  INVENTORY_BRANDS_CREATE: 'inventory.create',
  INVENTORY_COLORS_CREATE: 'inventory.create',
  INVENTORY_SIZES_CREATE: 'inventory.create',
  MEDIA_VIEW: 'media.view',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',
  MEDIA_MANAGE: 'media.manage',
  MEDIA_RESTORE: 'media.restore',
  AVAILABILITY_VIEW: 'availability.view',
  BARCODE_VIEW: 'barcode.view',
  BARCODE_GENERATE: 'barcode.generate',
  BARCODE_RESERVE: 'barcode.reserve',
  BARCODE_RELEASE: 'barcode.release',
  BARCODE_RETIRE: 'barcode.retire',
  RESERVATION_VIEW: 'reservation.view',
  RESERVATIONS_VIEW: 'reservation.view',
  RESERVATION_CREATE: 'reservation.create',
  RESERVATION_CHECKOUT: 'reservation.checkout',
  RESERVATION_CANCEL: 'reservation.cancel',
  RESERVATION_EXPIRE: 'reservation.expire',
  RENTAL_VIEW: 'rental.view',
  RENTALS_VIEW: 'rental.view',
  RENTAL_CREATE: 'rental.create',
  RENTAL_CHECKOUT: 'rental.checkout',
  RENTAL_RETURN: 'rental.return',
  RENTAL_CANCEL: 'rental.cancel',
  SALES_VIEW: 'sales.view',
  SALES_CREATE: 'sales.create',
  SALES_PAYMENT: 'sales.payment',
  SALES_COMPLETE: 'sales.complete',
  SALES_CANCEL: 'sales.cancel',
  FINANCE_VIEW: 'finance.view',
  FINANCE_PAYMENT: 'finance.payment',
  FINANCE_ADJUSTMENT: 'finance.adjustment',
  FINANCE_SETTLEMENT_VIEW: 'finance.settlement.view',
  FINANCE_SETTLEMENT_MANAGE: 'finance.settlement.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL_VIEW: 'reports.financial.view',
  REPORTS_EXPORT: 'reports.export',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE: 'users.manage',
  USERS_UNLOCK: 'users.unlock',
  ROLES_VIEW: 'roles.view',
  PERMISSIONS_VIEW: 'permissions.view',
} as const

export type PermissionKey = (typeof PERMISSION)[keyof typeof PERMISSION]

export function hasPermission(
  granted: readonly string[] | undefined,
  required: PermissionKey | readonly PermissionKey[] | undefined,
): boolean {
  if (!required) return true
  if (!granted || granted.length === 0) {
    // No permission list yet (session incomplete) — hide gated items.
    return false
  }
  const need = Array.isArray(required) ? required : [required]
  return need.some((p) => granted.includes(p))
}

/** Admin / full-access heuristic used only for shell visibility. */
export function isUnrestricted(
  granted: readonly string[] | undefined,
  roles?: readonly string[] | undefined,
): boolean {
  if (roles?.some((r) => r === 'Admin' || r === 'admin')) return true
  if (!granted) return false
  return granted.includes('*') || granted.length > 40
}
