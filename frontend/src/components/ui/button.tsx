import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon, type IconName } from '@/components/icons'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-button font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)]',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active',
        default:
          'bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'bg-secondary text-secondary-foreground border border-brand-border hover:bg-brand-subtle',
        outline:
          'border border-brand-border bg-transparent text-foreground hover:bg-brand-subtle hover:text-brand',
        ghost: 'bg-transparent text-brand hover:bg-brand-subtle',
        danger:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        sm: 'h-8 rounded-md px-3 gap-1.5',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 rounded-md px-8',
        default: 'h-10 px-4 py-2',
        icon: 'size-10 p-0'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
)

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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner size={iconSize} tone="inherit" label={null} /> : null}
        {!loading && leadingIcon ? <Icon name={leadingIcon} size={iconSize} /> : null}
        {children}
        {!loading && trailingIcon ? <Icon name={trailingIcon} size={iconSize} /> : null}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }
