import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { TextInput, type TextInputProps } from '@/components/ui/text-input'
import { cn } from '@/utils/cn'

export interface SearchInputProps extends Omit<TextInputProps, 'leadingIcon' | 'trailingIcon'> {
  onClear?: () => void
  clearLabel?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, clearLabel = 'مسح', value, onChange, ...props }, ref) => {
    const hasValue = value !== undefined && String(value).length > 0
    return (
      <div className="relative w-full">
        <TextInput
          ref={ref}
          type="search"
          leadingIcon="Search"
          value={value}
          onChange={onChange}
          className={cn(onClear && hasValue && 'pe-11', className)}
          {...props}
        />
        {onClear && hasValue ? (
          <span className="absolute end-1 top-0.5">
            <IconButton
              type="button"
              icon="X"
              size="sm"
              variant="ghost"
              aria-label={clearLabel}
              onClick={onClear}
            />
          </span>
        ) : null}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
