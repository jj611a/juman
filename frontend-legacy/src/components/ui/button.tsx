import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

const buttonVariants = cva('btn juman-focus no-animation gap-2 font-medium', {
  variants: {
    variant: {
      primary: 'btn-primary',
      default: 'btn-primary',
      secondary: 'btn-outline border-primary text-base-content hover:bg-primary/10',
      outline: 'btn-outline border-primary text-base-content',
      ghost: 'btn-ghost text-primary',
      danger: 'btn-error'
    },
    size: {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
      default: 'btn-md',
      icon: 'btn-square btn-md'
    }
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md'
  }
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leadingIcon?: IconName
  trailingIcon?: IconName
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      leadingIcon,
      trailingIcon,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const isDisabled = disabled || loading
    const iconSize = size === 'sm' ? 'sm' : size === 'lg' ? 'md' : 'sm'

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        {!loading && leadingIcon ? <Icon name={leadingIcon} size={iconSize} /> : null}
        {children}
        {!loading && trailingIcon ? <Icon name={trailingIcon} size={iconSize} /> : null}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }
