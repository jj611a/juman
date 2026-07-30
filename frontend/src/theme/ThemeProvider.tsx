import { useEffect, type ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useThemeStore } from '@/stores/themeStore'
import { themeMeta } from '@/theme/tokens'

export { themeMeta }

/**
 * Applies the official immutable Juman theme (v1: juman-dark only),
 * Arabic RTL, and UI scale. Kept for future multi-theme extensibility
 * without exposing a theme switcher in v1.
 */
export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const applyTheme = useThemeStore((s) => s.apply)
  const scale = useSettingsStore((s) => s.scale)

  useEffect(() => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
    document.documentElement.dataset.scale = scale
    applyTheme()
  }, [applyTheme, scale])

  return <>{children}</>
}
