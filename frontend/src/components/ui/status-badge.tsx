import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import type { DataStatusTone } from '@/components/ui/data-table/types'
import { cn } from '@/utils/cn'

const TONE_TO_VARIANT: Record<DataStatusTone, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'default'
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: DataStatusTone
  children: React.ReactNode
}

export function StatusBadge({
  tone = 'neutral',
  className,
  children,
  ...props
}: StatusBadgeProps): React.ReactElement {
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} className={cn(className)} {...props}>
      {children}
    </Badge>
  )
}

export type StatusMap<T extends string = string> = Record<T, { tone: DataStatusTone; label: React.ReactNode }>

/** Map a business status string → StatusBadge props. */
export function mapStatus<T extends string>(
  status: T,
  map: StatusMap<T>
): { tone: DataStatusTone; label: React.ReactNode } {
  const entry = map[status]
  if (!entry) {
    return { tone: 'neutral', label: String(status) }
  }
  return entry
}
