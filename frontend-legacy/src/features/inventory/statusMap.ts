import type { StatusMap } from '@/components/ui'

/**
 * Keys match Nest lifecycle tokens uppercased (via mapItemV2ToDress).
 * Labels only — Nest remains authority for allowed transitions.
 */
export const DRESS_STATUS_MAP: StatusMap = {
  AVAILABLE: { tone: 'success', label: 'متاح' },
  RESERVED: { tone: 'info', label: 'محجوز' },
  RENTED: { tone: 'warning', label: 'مؤجّر' },
  RETURN_PENDING: { tone: 'neutral', label: 'بانتظار الإرجاع' },
  INSPECTION: { tone: 'info', label: 'فحص' },
  CLEANING: { tone: 'warning', label: 'تنظيف' },
  MAINTENANCE: { tone: 'warning', label: 'صيانة' },
  FOR_SALE: { tone: 'info', label: 'للبيع' },
  SOLD: { tone: 'neutral', label: 'مباع' },
  RETIRED: { tone: 'danger', label: 'متقاعد' },
  LOST: { tone: 'danger', label: 'مفقود' },
  DAMAGED: { tone: 'danger', label: 'تالف' },
  // legacy aliases still shown if bridge emits them
  RETURNED: { tone: 'neutral', label: 'بانتظار الإرجاع' },
  PROCESSING: { tone: 'warning', label: 'معالجة' },
  RUINED: { tone: 'danger', label: 'متقاعد' },
  RUINED_PENDING_SALE: { tone: 'info', label: 'للبيع' }
}

export const DRESS_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'FREE'] as const
export const DRESS_COLOURS = [
  'BLACK',
  'WHITE',
  'RED',
  'PINK',
  'BLUE',
  'GREEN',
  'GOLD',
  'SILVER',
  'BEIGE',
  'NAVY',
  'PURPLE',
  'MULTI',
  'OTHER'
] as const

export const DRESS_COLOUR_LABELS: Record<string, string> = {
  BLACK: 'أسود',
  WHITE: 'أبيض',
  RED: 'أحمر',
  PINK: 'وردي',
  BLUE: 'أزرق',
  GREEN: 'أخضر',
  GOLD: 'ذهبي',
  SILVER: 'فضي',
  BEIGE: 'بيج',
  NAVY: 'كحلي',
  PURPLE: 'بنفسجي',
  MULTI: 'متعدد',
  OTHER: 'أخرى'
}

/** Nest ITEM_LIFECYCLE_TRANSITIONS expressed as uppercase keys for the status dialog. */
export const ALLOWED_DRESS_TRANSITIONS: Record<string, readonly string[]> = {
  AVAILABLE: ['RESERVED', 'FOR_SALE', 'MAINTENANCE', 'RETIRED', 'LOST', 'DAMAGED'],
  RESERVED: ['AVAILABLE', 'RENTED', 'LOST', 'DAMAGED'],
  RENTED: ['RETURN_PENDING', 'LOST', 'DAMAGED'],
  RETURN_PENDING: ['INSPECTION', 'LOST', 'DAMAGED'],
  INSPECTION: ['CLEANING', 'MAINTENANCE', 'AVAILABLE', 'DAMAGED', 'RETIRED'],
  CLEANING: ['AVAILABLE', 'MAINTENANCE'],
  MAINTENANCE: ['AVAILABLE', 'RETIRED', 'DAMAGED'],
  FOR_SALE: ['AVAILABLE', 'SOLD', 'RETIRED', 'LOST', 'DAMAGED'],
  SOLD: ['RETIRED'],
  RETIRED: [],
  LOST: ['AVAILABLE', 'RETIRED'],
  DAMAGED: ['MAINTENANCE', 'RETIRED'],
  // legacy aliases
  RETURNED: ['INSPECTION', 'LOST', 'DAMAGED'],
  PROCESSING: ['AVAILABLE', 'MAINTENANCE'],
  RUINED: [],
  RUINED_PENDING_SALE: ['AVAILABLE', 'SOLD', 'RETIRED', 'LOST', 'DAMAGED']
}
