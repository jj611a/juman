import * as React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TextInput } from '@/components/ui/text-input'
import { cn } from '@/utils/cn'

export interface AutocompleteOption {
  value: string
  label: string
}

export interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  onSearch?: (query: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  emptyText?: string
  'aria-label'?: string
}

export function Autocomplete({
  options,
  value,
  defaultValue = null,
  onChange,
  onSearch,
  placeholder = 'ابحث…',
  disabled,
  loading,
  className,
  emptyText = 'لا نتائج',
  'aria-label': ariaLabel
}: AutocompleteProps): React.ReactElement {
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string | null>(defaultValue)
  const selected = isControlled ? value : internal
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  const selectedLabel = options.find((o) => o.value === selected)?.label ?? ''

  React.useEffect(() => {
    if (!open && selected) {
      setQuery(selectedLabel)
    }
  }, [open, selected, selectedLabel])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [options, query])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const commit = (opt: AutocompleteOption | null): void => {
    if (!isControlled) setInternal(opt?.value ?? null)
    onChange?.(opt?.value ?? null)
    setQuery(opt?.label ?? '')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('w-full', className)}>
          <TextInput
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
            disabled={disabled}
            leadingIcon="Search"
            placeholder={placeholder}
            value={open ? query : selectedLabel || query}
            onChange={(e) => {
              const next = e.target.value
              setQuery(next)
              setOpen(true)
              onSearch?.(next)
              if (!next) commit(null)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
                setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && open && filtered[activeIndex]) {
                e.preventDefault()
                commit(filtered[activeIndex])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="h-56">
          <ul role="listbox" className="p-1">
            {loading ? (
              <li className="px-3 py-2 text-caption text-muted-foreground">جاري التحميل…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-caption text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((opt, index) => (
                <li key={opt.value} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full rounded-sm px-3 py-2 text-start text-body hover:bg-brand-subtle',
                      index === activeIndex && 'bg-brand-subtle',
                      selected === opt.value && 'text-brand'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
