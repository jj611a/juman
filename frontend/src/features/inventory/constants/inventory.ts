import {
  ITEM_LIFECYCLE_VALUES,
  ITEM_STATUS_VALUES,
  ITEM_CONDITION_VALUES,
  type ItemLifecycleState,
  type ItemStatus,
  type ItemCondition,
} from '../api/api'

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: 'مسودة',
  active: 'نشط',
  inactive: 'غير نشط',
  archived: 'مؤرشف',
  retired: 'متقاعد',
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'جديد',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'ضعيف',
  unknown: 'غير محدد',
}

export const LIFECYCLE_LABELS: Record<ItemLifecycleState, string> = {
  available: 'متاح',
  reserved: 'محجوز',
  rented: 'مُستأجر',
  return_pending: 'بانتظار الإرجاع',
  inspection: 'بالفحص',
  cleaning: 'بالتنظيف',
  maintenance: 'بالصيانة',
  for_sale: 'للبيع',
  sold: 'مُباع',
  retired: 'متقاعد',
  lost: 'مفقود',
  damaged: 'تالف',
}

export const LIFECYCLE_BADGE: Record<ItemLifecycleState, string> = {
  available: 'badge-success',
  reserved: 'badge-warning',
  rented: 'badge-info',
  return_pending: 'badge-warning',
  inspection: 'badge-neutral',
  cleaning: 'badge-neutral',
  maintenance: 'badge-warning',
  for_sale: 'badge-accent',
  sold: 'badge-ghost',
  retired: 'badge-ghost',
  lost: 'badge-error',
  damaged: 'badge-error',
}

export const STATUS_BADGE: Record<ItemStatus, string> = {
  draft: 'badge-ghost',
  active: 'badge-success',
  inactive: 'badge-neutral',
  archived: 'badge-warning',
  retired: 'badge-ghost',
}

export const CONDITION_BADGE: Record<ItemCondition, string> = {
  new: 'badge-success',
  good: 'badge-info',
  fair: 'badge-warning',
  poor: 'badge-error',
  unknown: 'badge-ghost',
}

/**
 * Allowed lifecycle transitions mirroring backend inventory.constants
 * ITEM_LIFECYCLE_TRANSITIONS. UI offers only these targets.
 */
export const LIFECYCLE_TRANSITIONS: Record<
  ItemLifecycleState,
  readonly ItemLifecycleState[]
> = {
  available: ['reserved', 'for_sale', 'maintenance', 'retired', 'lost', 'damaged'],
  reserved: ['available', 'rented', 'lost', 'damaged'],
  rented: ['return_pending', 'lost', 'damaged'],
  return_pending: ['inspection', 'lost', 'damaged'],
  inspection: ['cleaning', 'maintenance', 'available', 'damaged', 'retired'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'retired', 'damaged'],
  for_sale: ['available', 'sold', 'retired', 'lost', 'damaged'],
  sold: ['retired'],
  retired: [],
  lost: ['available', 'retired'],
  damaged: ['maintenance', 'retired'],
}

export const LIFECYCLE_OPTIONS = ITEM_LIFECYCLE_VALUES.map((v) => ({
  value: v,
  label: LIFECYCLE_LABELS[v],
}))

export const STATUS_OPTIONS = ITEM_STATUS_VALUES.map((v) => ({
  value: v,
  label: STATUS_LABELS[v],
}))

export const CONDITION_OPTIONS = ITEM_CONDITION_VALUES.map((v) => ({
  value: v,
  label: CONDITION_LABELS[v],
}))

export function formatFils(fils: number | null | undefined): string {
  if (fils === null || fils === undefined) return '—'
  return `${(fils / 1000).toLocaleString('ar-AE', { maximumFractionDigits: 2 })} د.إ`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-AE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-AE', { dateStyle: 'medium', timeStyle: 'short' })
}
