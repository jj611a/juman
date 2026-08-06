import * as React from 'react'
import { cn } from '@/utils/cn'

export interface RelativeTimeProps extends React.HTMLAttributes<HTMLTimeElement> {
  value: string | Date
  /** Optional override for the visible label. */
  label?: string
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value
}

function formatRelative(date: Date, now = new Date()): string {
  const diffMs = date.getTime() - now.getTime()
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  const absMin = Math.round(absSec / 60)
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute')
  const absHr = Math.round(absMin / 60)
  if (absHr < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour')
  const absDay = Math.round(absHr / 24)
  if (absDay < 30) return rtf.format(Math.round(diffMs / 86400000), 'day')
  const absMonth = Math.round(absDay / 30)
  if (absMonth < 12) return rtf.format(Math.round(diffMs / 2592000000), 'month')
  return rtf.format(Math.round(diffMs / 31536000000), 'year')
}

export function RelativeTime({
  value,
  label,
  className,
  ...props
}: RelativeTimeProps): React.ReactElement {
  const date = toDate(value)
  const valid = !Number.isNaN(date.getTime())
  const text = label ?? (valid ? formatRelative(date) : String(value))
  return (
    <time
      className={cn('text-caption text-muted-foreground', className)}
      dateTime={valid ? date.toISOString() : undefined}
      title={valid ? date.toLocaleString('ar-IQ') : undefined}
      {...props}
    >
      {text}
    </time>
  )
}
