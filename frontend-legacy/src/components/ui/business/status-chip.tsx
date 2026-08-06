import * as React from 'react'
import { Icon, type IconName } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { mapStatus, type StatusMap } from '@/components/ui/status-badge'
import type { DataStatusTone } from '@/components/ui/data-table/types'
import { cn } from '@/utils/cn'

const TONE_TO_VARIANT: Record<DataStatusTone, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'default'
}

export interface StatusChipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  status?: string
  map?: StatusMap
  tone?: DataStatusTone
  label?: React.ReactNode
  icon?: IconName
}

export function StatusChip({
  status,
  map,
  tone,
  label,
  icon,
  className,
  ...props
}: StatusChipProps): React.ReactElement {
  const mapped = status && map ? mapStatus(status, map) : null
  const resolvedTone = tone ?? mapped?.tone ?? 'neutral'
  const resolvedLabel = label ?? mapped?.label ?? status ?? ''
  return (
    <Badge
      variant={TONE_TO_VARIANT[resolvedTone]}
      className={cn('inline-flex items-center gap-1.5', className)}
      data-tone={resolvedTone}
      {...props}
    >
      {icon ? <Icon name={icon} size={14} aria-hidden /> : null}
      <span>{resolvedLabel}</span>
    </Badge>
  )
}
