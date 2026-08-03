import * as React from 'react'
import { StatusChip, type StatusChipProps } from '@/components/ui/business/status-chip'
import { cn } from '@/utils/cn'

export interface EntityHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  status?: StatusChipProps
  leading?: React.ReactNode
  actions?: React.ReactNode
}

export function EntityHeader({
  title,
  description,
  status,
  leading,
  actions,
  className,
  ...props
}: EntityHeaderProps): React.ReactElement {
  return (
    <header
      className={cn('flex flex-wrap items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {leading}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-h3 text-foreground">{title}</h2>
            {status ? <StatusChip {...status} /> : null}
          </div>
          {description ? (
            <p className="text-body text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
