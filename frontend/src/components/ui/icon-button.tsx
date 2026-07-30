import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)]',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-foreground hover:bg-brand-hover',
        secondary: 'bg-secondary text-secondary-foreground border border-brand-border hover:bg-brand-subtle',
        outline: 'border border-brand-border bg-transparent text-brand hover:bg-brand-subtle',
        ghost: 'bg-transparent text-brand hover:bg-brand-subtle',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        sm: 'size-8',
        md: 'size-10',
        lg: 'size-11'
      }
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md'
    }
  }
)

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  icon: IconName
  /** Required accessible name for icon-only control. */
  'aria-label': string
  loading?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, icon, loading = false, disabled, ...props }, ref) => {
    const iconSize = size === 'sm' ? 'sm' : 'md'
    return (
      <button
        type="button"
        ref={ref}
        className={cn(iconButtonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner size={iconSize} /> : <Icon name={icon} size={iconSize} />}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'
