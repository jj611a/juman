import * as React from 'react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

export interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** fullscreen = fixed viewport; container = absolute fill of positioned parent */
  variant?: 'fullscreen' | 'container'
  transparent?: boolean
  message?: React.ReactNode
  open?: boolean
}

export function LoadingOverlay({
  variant = 'container',
  transparent = false,
  message = 'جاري التحميل…',
  open = true,
  className,
  ...props
}: LoadingOverlayProps): React.ReactElement | null {
  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'inset-0 z-[var(--z-overlay)] flex flex-col items-center justify-center gap-3',
        variant === 'fullscreen' ? 'fixed' : 'absolute',
        transparent ? 'bg-background/40' : 'bg-background/80',
        className
      )}
      {...props}
    >
      <Spinner size="lg" tone="brand" label={null} />
      {message ? <p className="text-caption text-muted-foreground">{message}</p> : null}
    </div>
  )
}
