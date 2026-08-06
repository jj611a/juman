import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon } from '@/components/icons'
import { cn } from '@/utils/cn'

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-caption font-medium',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-secondary-foreground',
        brand: 'border-brand-border bg-brand-subtle text-brand'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  onDismiss?: () => void
  dismissLabel?: string
}

export function Chip({
  className,
  variant,
  onDismiss,
  dismissLabel = 'إزالة',
  children,
  ...props
}: ChipProps): React.ReactElement {
  return (
    <span className={cn(chipVariants({ variant }), className)} {...props}>
      {children}
      {onDismiss ? (
        <button
          type="button"
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <Icon name="X" size={12} />
        </button>
      ) : null}
    </span>
  )
}
