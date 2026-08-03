import * as React from 'react'
import { cn } from '@/utils/cn'

export interface AuditTimelineItem {
  id: string
  at: string | Date
  actor?: React.ReactNode
  action: React.ReactNode
  detail?: React.ReactNode
}

export interface AuditTimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: AuditTimelineItem[]
}

function formatAt(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ar-IQ')
}

/** Presentation-only audit trail. No API. */
export function AuditTimeline({ items, className, ...props }: AuditTimelineProps): React.ReactElement {
  return (
    <ol className={cn('space-y-4 border-s border-border ps-4', className)} {...props}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden
            className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full bg-brand"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-body font-medium text-foreground">{item.action}</span>
              {item.actor ? (
                <span className="text-caption text-muted-foreground">{item.actor}</span>
              ) : null}
            </div>
            <time className="block text-caption text-muted-foreground" dateTime={String(item.at)}>
              {formatAt(item.at)}
            </time>
            {item.detail ? <p className="text-caption text-foreground-secondary">{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
