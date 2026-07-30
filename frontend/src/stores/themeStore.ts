import { create } from 'zustand'
import { THEME_ID, THEME_MODE, type ThemeId, type ThemeMode } from '@/theme/tokens'

interface ThemeState {
  /** Official v1 theme — immutable. */
  id: ThemeId
  mode: ThemeMode
  resolved: 'dark'
  /** Applies `data-theme` on documentElement. No mode switching in v1. */
  apply: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  id: THEME_ID,
  mode: THEME_MODE,
  resolved: 'dark',
  apply: () => {
    document.documentElement.dataset.theme = THEME_ID
    set({ id: THEME_ID, mode: THEME_MODE, resolved: 'dark' })
  }
}))
