import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badgeVariants = cva('badge gap-1 border-0 font-medium', {
  variants: {
    variant: {
      default: 'badge-neutral',
      brand: 'badge-primary',
      success: 'badge-success',
      warning: 'badge-warning',
      danger: 'badge-error',
      info: 'badge-info',
      outline: 'badge-outline border-base-content/20'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.ReactElement {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
