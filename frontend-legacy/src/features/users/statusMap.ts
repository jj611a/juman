import type { StatusMap } from '@/components/ui'

export const USER_ACTIVE_STATUS_MAP: StatusMap<'active' | 'inactive'> = {
  active: { tone: 'success', label: 'نشط' },
  inactive: { tone: 'neutral', label: 'غير نشط' }
}

export const USER_LOCKED_STATUS_MAP: StatusMap<'locked' | 'unlocked'> = {
  locked: { tone: 'danger', label: 'مقفل' },
  unlocked: { tone: 'success', label: 'غير مقفل' }
}

export function userActiveKey(isActive: boolean): 'active' | 'inactive' {
  return isActive ? 'active' : 'inactive'
}

export function userLockedKey(isLocked: boolean): 'locked' | 'unlocked' {
  return isLocked ? 'locked' : 'unlocked'
}
