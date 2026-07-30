import * as React from 'react'
import { cn } from '@/utils/cn'

export const ValidationMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  if (!children) return null
  return (
    <p ref={ref} role="alert" className={cn('text-caption text-destructive', className)} {...props}>
      {children}
    </p>
  )
})
ValidationMessage.displayName = 'ValidationMessage'
