import type { StatusMap } from '@/components/ui'

/** Backend dress status → StatusChip / StatusBadge. Display only — never invent status. */
export const DRESS_STATUS_MAP: StatusMap = {
  AVAILABLE: { tone: 'success', label: 'متاح' },
  RESERVED: { tone: 'info', label: 'محجوز' },
  RENTED: { tone: 'warning', label: 'مؤجّر' },
  RETURNED: { tone: 'neutral', label: 'مُعاد' },
  INSPECTION: { tone: 'info', label: 'فحص' },
  PROCESSING: { tone: 'warning', label: 'معالجة' },
  SOLD: { tone: 'neutral', label: 'مباع' },
  RUINED: { tone: 'danger', label: 'تالف' },
  RUINED_PENDING_SALE: { tone: 'danger', label: 'تالف بانتظار البيع' }
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


/** Display helpers for status dialog — backend remains authority. */
export const ALLOWED_DRESS_TRANSITIONS: Record<string, readonly string[]> = {
  AVAILABLE: ['RESERVED', 'RENTED', 'SOLD'],
  RESERVED: ['AVAILABLE', 'RENTED'],
  RENTED: ['INSPECTION'],
  INSPECTION: ['PROCESSING', 'AVAILABLE', 'RUINED_PENDING_SALE'],
  PROCESSING: ['AVAILABLE'],
  RUINED_PENDING_SALE: ['SOLD', 'RUINED'],
  SOLD: [],
  RUINED: [],
  RETURNED: []
}
