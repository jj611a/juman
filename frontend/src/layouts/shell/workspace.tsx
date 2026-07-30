import * as React from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { cn } from '@/utils/cn'

export interface WorkspaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'main' | 'div' | 'section'
  loading?: boolean
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: React.ReactNode
  error?: Error | string | null
  onRetry?: () => void
}

export function Workspace({
  as: Comp = 'main',
  className,
  children,
  loading,
  empty,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  error,
  onRetry,
  ...props
}: WorkspaceProps): React.ReactElement {
  return (
    <Comp className={cn('relative min-h-0 flex-1 overflow-auto bg-surface', className)} {...props}>
      {loading ? <LoadingOverlay message="جاري التحميل…" /> : null}
      {!loading && error ? (
        <div className="p-6">
          <ErrorState
            title="تعذر التحميل"
            message={typeof error === 'string' ? error : error.message}
            onRetry={onRetry}
          />
        </div>
      ) : null}
      {!loading && !error && empty ? (
        <div className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : null}
      {!loading && !error && !empty ? children : null}
    </Comp>
  )
}
