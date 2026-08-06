import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface FilePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: FileList | null
  onChange?: (files: FileList | null) => void
  label?: string
  emptyLabel?: string
}

export const FilePicker = React.forwardRef<HTMLInputElement, FilePickerProps>(
  (
    {
      className,
      value,
      onChange,
      label = 'اختر ملفاً',
      emptyLabel = 'لم يُحدَّد ملف',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const setRefs = (node: HTMLInputElement | null): void => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    const names = value && value.length > 0 ? Array.from(value).map((f) => f.name).join(', ') : emptyLabel

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <input
          ref={setRefs}
          id={id}
          type="file"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.files)}
          {...props}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            leadingIcon="Paperclip"
            onClick={() => inputRef.current?.click()}
          >
            {label}
          </Button>
          <span className="truncate text-caption text-muted-foreground">{names}</span>
        </div>
      </div>
    )
  }
)
FilePicker.displayName = 'FilePicker'
