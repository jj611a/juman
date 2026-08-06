import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'

type ShortcutHandler = () => void

interface ShortcutContextValue {
  register: (combo: string, handler: ShortcutHandler) => () => void
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null)

function normalizeCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  return parts.join('+')
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const handlers = useMemo(() => new Map<string, Set<ShortcutHandler>>(), [])

  const register = useCallback(
    (combo: string, handler: ShortcutHandler) => {
      const key = combo
      if (!handlers.has(key)) handlers.set(key, new Set())
      handlers.get(key)!.add(handler)
      return () => handlers.get(key)?.delete(handler)
    },
    [handlers],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (!(e.ctrlKey || e.metaKey)) return
      }
      const combo = normalizeCombo(e)
      const set = handlers.get(combo)
      if (!set || set.size === 0) return
      e.preventDefault()
      for (const h of Array.from(set)) h()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])

  const value = useMemo(() => ({ register }), [register])
  return (
    <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>
  )
}

export function useShortcuts(): ShortcutContextValue {
  const ctx = useContext(ShortcutContext)
  if (!ctx) throw new Error('useShortcuts requires ShortcutProvider')
  return ctx
}
