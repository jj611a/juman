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
  CATEGORIES_VIEW: 'categories.view',
  MEDIA_VIEW: 'media.view',
  BARCODE_VIEW: 'barcode.view',
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
  FINANCE_VIEW: 'finance.view',
  FINANCE_SETTLEMENT_VIEW: 'finance.settlement.view',
  REPORTS_VIEW: 'reports.view',
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
