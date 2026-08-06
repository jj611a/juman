import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { APP_THEME_ID } from '@/shared/constants/app'

export type GlassIntensity = 'off' | 'subtle' | 'strong'

interface ThemeContextValue {
  themeId: typeof APP_THEME_ID
  glass: GlassIntensity
  setGlass: (value: GlassIntensity) => void
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (value: boolean) => void
}

const STORAGE_GLASS = 'juman.theme.glass'
const STORAGE_SIDEBAR = 'juman.theme.sidebarCollapsed'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readGlass(): GlassIntensity {
  const v = localStorage.getItem(STORAGE_GLASS)
  if (v === 'off' || v === 'subtle' || v === 'strong') return v
  return 'subtle'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [glass, setGlassState] = useState<GlassIntensity>(() => readGlass())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(STORAGE_SIDEBAR) === '1',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', APP_THEME_ID)
    document.documentElement.setAttribute('data-glass', glass)
  }, [glass])

  const setGlass = useCallback((value: GlassIntensity) => {
    setGlassState(value)
    localStorage.setItem(STORAGE_GLASS, value)
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_SIDEBAR, next ? '1' : '0')
      return next
    })
  }, [])

  const setCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsed(value)
    localStorage.setItem(STORAGE_SIDEBAR, value ? '1' : '0')
  }, [])

  const value = useMemo(
    () => ({
      themeId: APP_THEME_ID,
      glass,
      setGlass,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      setSidebarCollapsed: setCollapsed,
    }),
    [glass, setGlass, sidebarCollapsed, toggleSidebarCollapsed, setCollapsed],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme requires ThemeProvider')
  return ctx
}
