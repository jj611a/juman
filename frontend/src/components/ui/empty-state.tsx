import * as React from 'react'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: IconName
  illustration?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  primaryAction?: React.ReactNode
  secondaryAction?: React.ReactNode
}

export function EmptyState({
  icon = 'Inbox',
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
      {...props}
    >
      {illustration ?? (
        <div className="flex size-12 items-center justify-center rounded-md border border-border bg-panel">
          <Icon name={icon} size="md" className="text-muted-foreground" />
        </div>
      )}
      <h3 className="text-title text-foreground">{title}</h3>
      {description ? <p className="max-w-md text-body text-muted-foreground">{description}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
