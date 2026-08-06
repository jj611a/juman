import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'size-3.5',
        md: 'size-4',
        lg: 'size-5'
      },
      tone: {
        brand: 'text-brand',
        muted: 'text-muted-foreground',
        inherit: 'text-current'
      }
    },
    defaultVariants: {
      size: 'md',
      tone: 'inherit'
    }
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible name. Pass `null` when a parent already announces loading. */
  label?: string | null
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size, tone, label = 'جاري التحميل', ...props }, ref) => {
    const decorative = label === null
    return (
      <span
        ref={ref}
        role={decorative ? undefined : 'status'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        className={cn(spinnerVariants({ size, tone }), className)}
        {...props}
      />
    )
  }
)
Spinner.displayName = 'Spinner'
