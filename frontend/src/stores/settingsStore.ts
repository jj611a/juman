import { create } from 'zustand'

export type UiScale = 'compact' | 'comfortable' | 'large'

interface SettingsState {
  locale: 'ar'
  scale: UiScale
  setScale: (scale: UiScale) => void
}

const STORAGE_KEY = 'juman.settings.v1'

function loadScale(): UiScale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'comfortable'
    const parsed = JSON.parse(raw) as { scale?: UiScale }
    return parsed.scale ?? 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  locale: 'ar',
  scale: typeof window !== 'undefined' ? loadScale() : 'comfortable',
  setScale: (scale) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scale }))
    document.documentElement.dataset.scale = scale
    set({ scale })
  }
}))
