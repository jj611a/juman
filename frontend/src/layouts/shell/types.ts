import type { IconName } from '@/components/icons'

export interface ShellNavBadge {
  label: string
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
}

export interface ShellNavItem {
  id: string
  label: string
  href?: string
  icon?: IconName
  badge?: ShellNavBadge | number | string
  permission?: string
  anyOf?: string[]
  allOf?: string[]
  disabled?: boolean
}

export interface ShellNavSection {
  id: string
  label: string
  items: ShellNavItem[]
}
