import * as React from 'react'
import { SearchInput, type SearchInputProps } from '@/components/ui/search-input'
import { cn } from '@/utils/cn'

export interface SearchBarProps extends Omit<SearchInputProps, 'onChange' | 'value' | 'onClear'> {
  /** Debounced committed value (controlled outbound). */
  value: string
  onValueChange: (value: string) => void
  debounceMs?: number
  /** Optional keyboard shortcut hint shown beside the field. */
  shortcutHint?: string
  /** Called when consumer wires a global shortcut (Cmd/Ctrl+K ready). */
  onShortcut?: () => void
}

export function SearchBar({
  value,
  onValueChange,
  debounceMs = 300,
  shortcutHint,
  onShortcut,
  className,
  placeholder = 'بحث…',
  ...props
}: SearchBarProps): React.ReactElement {
  const [draft, setDraft] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setDraft(value)
  }, [value])

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== value) onValueChange(draft)
    }, debounceMs)
    return () => window.clearTimeout(handle)
  }, [draft, debounceMs, onValueChange, value])

  React.useEffect(() => {
    if (!onShortcut) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onShortcut()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onShortcut])

  return (
    <div className={cn('flex w-full max-w-md items-center gap-2', className)}>
      <SearchInput
        ref={inputRef}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onClear={() => {
          setDraft('')
          onValueChange('')
        }}
        {...props}
      />
      {shortcutHint ? (
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
          {shortcutHint}
        </kbd>
      ) : null}
    </div>
  )
}
