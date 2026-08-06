import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/utils/cn'

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-label text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-[var(--disabled-opacity)]', className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName
