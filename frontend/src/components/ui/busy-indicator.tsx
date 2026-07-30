import * as React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

export interface BusyIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function BusyIndicator({
  label = 'جاري العمل…',
  size = 'sm',
  className,
  ...props
}: BusyIndicatorProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      {...props}
    >
      <Spinner size={size} tone="muted" label={null} />
      {label ? <span className="text-caption">{label}</span> : null}
    </div>
  )
}
