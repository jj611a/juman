import * as React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  toolbar?: React.ReactNode
  actions?: React.ReactNode
  loading?: boolean
  empty?: React.ReactNode
}

export function Panel({
  title,
  subtitle,
  toolbar,
  actions,
  loading = false,
  empty,
  className,
  children,
  ...props
}: PanelProps): React.ReactElement {
  const showEmpty =
    !loading && empty != null && (children === undefined || children === null || children === false)

  return (
    <section
      className={cn('flex flex-col overflow-hidden rounded-md border border-border bg-panel', className)}
      {...props}
    >
      {(title || subtitle || toolbar || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex flex-col gap-0.5">
            {title ? <h3 className="text-title text-foreground">{title}</h3> : null}
            {subtitle ? <p className="text-caption text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            {actions}
          </div>
        </header>
      )}
      <div className="relative min-h-24 flex-1 p-4">
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Spinner size="md" tone="muted" label={null} />
            <span className="text-caption">جاري التحميل…</span>
          </div>
        ) : showEmpty ? (
          empty
        ) : (
          children
        )}
      </div>
    </section>
  )
}
