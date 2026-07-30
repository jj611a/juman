import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'

const alertVariants = cva('relative flex w-full gap-3 rounded-md border px-4 py-3 text-body', {
  variants: {
    variant: {
      success: 'border-success/40 bg-success/10 text-foreground',
      info: 'border-info/40 bg-info/10 text-foreground',
      warning: 'border-warning/40 bg-warning/10 text-foreground',
      danger: 'border-destructive/40 bg-destructive/10 text-foreground'
    }
  },
  defaultVariants: { variant: 'info' }
})

const ALERT_ICON: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, IconName> = {
  success: 'CheckCircle2',
  info: 'Info',
  warning: 'AlertTriangle',
  danger: 'CircleAlert'
}

const ICON_TONE: Record<string, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-destructive'
}

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: IconName | false
  dismissible?: boolean
  onDismiss?: () => void
}

export function Alert({
  className,
  variant = 'info',
  title,
  description,
  icon,
  dismissible = false,
  onDismiss,
  children,
  ...props
}: AlertProps): React.ReactElement {
  const resolvedIcon = icon === false ? null : (icon ?? ALERT_ICON[variant ?? 'info'])
  const live = variant === 'danger' ? 'assertive' : 'polite'

  return (
    <div
      role="alert"
      aria-live={live}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {resolvedIcon ? (
        <Icon name={resolvedIcon} size="sm" className={cn('mt-0.5 shrink-0', ICON_TONE[variant ?? 'info'])} />
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {description ? <AlertDescription>{description}</AlertDescription> : null}
        {children}
      </div>
      {dismissible ? (
        <IconButton
          icon="X"
          size="sm"
          variant="ghost"
          aria-label="إغلاق"
          className="shrink-0"
          onClick={onDismiss}
        />
      ) : null}
    </div>
  )
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h5 className={cn('text-caption font-medium leading-none tracking-tight', className)} {...props} />
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return <p className={cn('mt-1 text-caption text-muted-foreground', className)} {...props} />
}
