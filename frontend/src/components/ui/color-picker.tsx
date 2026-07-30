import * as React from 'react'
import { fieldVariants, type FieldVariantProps } from '@/components/ui/input-base'
import { cn } from '@/utils/cn'

export interface ColorPickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    FieldVariantProps {}

export const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ className, fieldSize, fieldState, value, ...props }, ref) => {
    return (
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          type="color"
          value={value ?? '#c6a75e'}
          className={cn(
            'size-10 cursor-pointer overflow-hidden rounded-md border border-border bg-card p-1',
            className
          )}
          {...props}
        />
        <input
          type="text"
          readOnly
          value={String(value ?? '#c6a75e')}
          aria-hidden
          tabIndex={-1}
          className={cn(fieldVariants({ fieldSize: fieldSize ?? 'md', fieldState }), 'input-phone max-w-32')}
        />
      </div>
    )
  }
)
ColorPicker.displayName = 'ColorPicker'
