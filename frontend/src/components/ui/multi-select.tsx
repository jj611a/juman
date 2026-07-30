import * as React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip } from '@/components/ui/chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Icon } from '@/components/icons'
import { cn } from '@/utils/cn'

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value?: string[]
  defaultValue?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function MultiSelect({
  options,
  value,
  defaultValue = [],
  onChange,
  placeholder = 'اختر…',
  disabled,
  className,
  'aria-label': ariaLabel
}: MultiSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string[]>(defaultValue)
  const selected = isControlled ? value : internal

  const setSelected = (next: string[]): void => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const toggle = (v: string): void => {
    setSelected(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }

  const labels = options.filter((o) => selected.includes(o.value))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-start text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-[var(--disabled-opacity)]',
            className
          )}
        >
          {labels.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            labels.map((o) => (
              <Chip
                key={o.value}
                variant="brand"
                onDismiss={() => toggle(o.value)}
                dismissLabel={`إزالة ${o.label}`}
              >
                {o.label}
              </Chip>
            ))
          )}
          <Icon name="ChevronDown" size="sm" className="ms-auto text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <ScrollArea className="h-56">
          <ul className="flex flex-col gap-1 p-2" role="listbox" aria-multiselectable="true">
            {options.map((o) => (
              <li key={o.value}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 hover:bg-brand-subtle',
                    o.disabled && 'pointer-events-none opacity-[var(--disabled-opacity)]'
                  )}
                >
                  <Checkbox
                    checked={selected.includes(o.value)}
                    disabled={o.disabled || disabled}
                    onCheckedChange={() => toggle(o.value)}
                    aria-label={o.label}
                  />
                  <span className="text-body">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
