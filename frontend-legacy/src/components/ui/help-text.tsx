import * as React from 'react'
import { cn } from '@/utils/cn'

export const HelpText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-caption text-muted-foreground', className)} {...props} />
))
HelpText.displayName = 'HelpText'
