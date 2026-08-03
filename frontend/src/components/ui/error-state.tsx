import * as React from 'react'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  /** Optional body copy; defaults to a generic Arabic message. */
  message?: React.ReactNode
  errorCode?: string
  onRetry?: () => void
  retryLabel?: string
  /** Shown only in development builds. */
  details?: React.ReactNode
}

export function ErrorState({
  title = 'حدث خطأ',
  message = 'تعذّر إكمال العملية. حاول مرة أخرى.',
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
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-juman-in',
        className
      )}
      {...props}
    >
      <div className="alert alert-error max-w-md shadow-sm">
        <Icon name="CircleAlert" size="md" className="shrink-0" />
        <div className="text-start">
          <h3 className="text-title font-semibold">{title}</h3>
          <p className="mt-1 text-body opacity-90">{message}</p>
          {errorCode ? (
            <p className="mt-2 text-caption opacity-70" dir="ltr">
              {errorCode}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {showDetails ? (
        <pre className="mt-2 max-w-full overflow-auto rounded-box border border-base-content/10 bg-base-200 p-3 text-start text-[11px] text-base-content/60">
          {details}
        </pre>
      ) : null}
    </div>
  )
}
