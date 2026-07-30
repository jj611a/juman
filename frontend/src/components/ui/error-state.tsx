import * as React from 'react'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  message: React.ReactNode
  errorCode?: string
  onRetry?: () => void
  retryLabel?: string
  /** Shown only in development builds. */
  details?: React.ReactNode
}

export function ErrorState({
  title = 'حدث خطأ',
  message,
  errorCode,
  onRetry,
  retryLabel = 'إعادة المحاولة',
  details,
  className,
  ...props
}: ErrorStateProps): React.ReactElement {
  const showDetails = Boolean(details) && import.meta.env.DEV

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10">
        <Icon name="CircleAlert" size="md" className="text-destructive" />
      </div>
      <h3 className="text-title text-foreground">{title}</h3>
      <p className="max-w-md text-body text-muted-foreground">{message}</p>
      {errorCode ? (
        <p className="text-caption text-muted-foreground" dir="ltr">
          {errorCode}
        </p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {showDetails ? (
        <pre className="mt-2 max-w-full overflow-auto rounded-md border border-border bg-panel p-3 text-start text-[11px] text-muted-foreground">
          {details}
        </pre>
      ) : null}
    </div>
  )
}
