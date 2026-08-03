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
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-juman-in',
        className
      )}
      {...props}
    >
      {illustration ?? (
        <div className="flex size-14 items-center justify-center rounded-box border border-base-content/10 bg-base-200 shadow-sm">
          <Icon name={icon} size="md" className="text-primary" />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-title text-base-content">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-md text-body text-base-content/60">{description}</p>
        ) : null}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
