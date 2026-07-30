import type { SettingCategory, SettingDto } from '@/services/domainTypes'

export const SETTING_CATEGORIES: { value: SettingCategory; label: string }[] = [
  { value: 'company', label: 'الشركة' },
  { value: 'financial', label: 'مالية' },
  { value: 'processing', label: 'المعالجة' },
  { value: 'inventory', label: 'المخزون' },
  { value: 'customers', label: 'العملاء' },
  { value: 'reservations', label: 'الحجوزات' },
  { value: 'sales', label: 'المبيعات' },
  { value: 'rentals', label: 'التأجير' },
  { value: 'returns', label: 'الإرجاع' },
  { value: 'inspection', label: 'الفحص' },
  { value: 'system', label: 'النظام' }
]

export type SystemSettingSubgroup = 'security' | 'media' | 'backup' | 'other'

export const SYSTEM_SUBGROUP_ORDER: SystemSettingSubgroup[] = [
  'security',
  'media',
  'backup',
  'other'
]

export const SYSTEM_SUBGROUP_LABELS: Record<SystemSettingSubgroup, string> = {
  security: 'الأمان والجلسات',
  media: 'الوسائط',
  backup: 'النسخ الاحتياطي',
  other: 'أخرى'
}

const SECURITY_PREFIXES = [
  'password_',
  'max_failed_',
  'account_lock_',
  'access_token_',
  'refresh_token_',
  'remember_me_'
] as const

export function getSystemSubgroup(key: string): SystemSettingSubgroup {
  if (SECURITY_PREFIXES.some((prefix) => key.startsWith(prefix))) return 'security'
  if (key.startsWith('media_')) return 'media'
  if (key.startsWith('backup.')) return 'backup'
  return 'other'
}

export function groupSystemSettings(items: SettingDto[]): Map<SystemSettingSubgroup, SettingDto[]> {
  const grouped = new Map<SystemSettingSubgroup, SettingDto[]>()
  for (const subgroup of SYSTEM_SUBGROUP_ORDER) grouped.set(subgroup, [])
  for (const item of items) {
    grouped.get(getSystemSubgroup(item.key))!.push(item)
  }
  return grouped
}

export function categoryLabel(category: SettingCategory | string): string {
  return SETTING_CATEGORIES.find((entry) => entry.value === category)?.label ?? String(category)
}
