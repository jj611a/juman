import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

const inlineVariants = cva('inline-flex max-w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-caption', {
  variants: {
    variant: {
      info: 'bg-info/10 text-foreground',
      warning: 'bg-warning/10 text-foreground',
      error: 'bg-destructive/10 text-foreground',
      success: 'bg-success/10 text-foreground'
    }
  },
  defaultVariants: { variant: 'info' }
})

const ICONS: Record<string, IconName> = {
  info: 'Info',
  warning: 'AlertTriangle',
  error: 'CircleAlert',
  success: 'CheckCircle2'
}

const ICON_TONE: Record<string, string> = {
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-destructive',
  success: 'text-success'
}

export interface InlineMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inlineVariants> {}

export function InlineMessage({
  className,
  variant = 'info',
  children,
  ...props
}: InlineMessageProps): React.ReactElement {
  const v = variant ?? 'info'
  return (
    <div
      role="status"
      aria-live={v === 'error' ? 'assertive' : 'polite'}
      className={cn(inlineVariants({ variant: v }), className)}
      {...props}
    >
      <Icon name={ICONS[v]!} size={14} className={cn('mt-0.5 shrink-0', ICON_TONE[v])} />
      <span className="min-w-0">{children}</span>
    </div>
  )
}
