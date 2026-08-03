import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const cardVariants = cva('card bg-base-300 text-base-content juman-surface animate-juman-in', {
  variants: {
    variant: {
      default: 'border border-base-content/10 shadow-sm',
      outlined: 'border border-base-content/15 bg-transparent shadow-none',
      elevated: 'border border-base-content/10 shadow-md',
      interactive:
        'border border-base-content/10 transition-[box-shadow,border-color,background-color] duration-[var(--duration-fast)] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      highlighted: 'border border-base-content/10 border-t-2 border-t-primary border-t-brand shadow-sm'
    }
  },
  defaultVariants: { variant: 'default' }
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  )
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('card-body gap-1.5 p-5 pb-2', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('card-title text-title text-base-content', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-caption text-base-content/60', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('card-body p-5 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('card-actions items-center gap-2 p-5 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'
