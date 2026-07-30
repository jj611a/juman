import { create } from 'zustand'

interface WindowState {
  maximized: boolean
  setMaximized: (maximized: boolean) => void
}

export const useWindowStore = create<WindowState>((set) => ({
  maximized: false,
  setMaximized: (maximized) => set({ maximized })
}))
