import * as React from 'react'
import { shortcutRegistry } from './shortcut-registry'

export function ShortcutProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }
      shortcutRegistry.handle(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <>{children}</>
}

export function useShortcut(
  id: string,
  combo: string,
  handler: (event: KeyboardEvent) => void,
  enabled = true
): void {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    return shortcutRegistry.register({
      id,
      combo,
      enabled,
      handler: (e) => handlerRef.current(e)
    })
  }, [id, combo, enabled])
}
