import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

const iconButtonVariants = cva('btn btn-square juman-focus no-animation', {
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-outline border-primary',
      outline: 'btn-outline border-primary',
      ghost: 'btn-ghost text-primary',
      danger: 'btn-error'
    },
    size: {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg'
    }
  },
  defaultVariants: {
    variant: 'ghost',
    size: 'md'
  }
})

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
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <Icon name={icon} size={iconSize} />
        )}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'
