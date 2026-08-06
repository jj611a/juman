import * as React from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'

export interface ProgressOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'fullscreen' | 'container'
  transparent?: boolean
  message?: React.ReactNode
  value: number
  open?: boolean
}

export function ProgressOverlay({
  variant = 'container',
  transparent = false,
  message,
  value,
  open = true,
  className,
  ...props
}: ProgressOverlayProps): React.ReactElement | null {
  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'inset-0 z-[var(--z-overlay)] flex flex-col items-center justify-center gap-3 px-6',
        variant === 'fullscreen' ? 'fixed' : 'absolute',
        transparent ? 'bg-background/40' : 'bg-background/80',
        className
      )}
      {...props}
    >
      <div className="w-full max-w-xs">
        <Progress value={value} aria-label={typeof message === 'string' ? message : 'التقدّم'} />
      </div>
      {message ? <p className="text-caption text-muted-foreground">{message}</p> : null}
    </div>
  )
}
