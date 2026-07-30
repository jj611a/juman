import { create } from 'zustand'
import type { SessionView } from '@shared/session'

interface AuthState {
  ready: boolean
  session: SessionView
  setSession: (session: SessionView) => void
  setReady: (ready: boolean) => void
  hasPermission: (key: string) => boolean
  hasAnyPermission: (keys: string[]) => boolean
  hasAllPermission: (keys: string[]) => boolean
}

const emptySession: SessionView = { authenticated: false, permissions: [] }

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  session: emptySession,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
  hasPermission: (key) => {
    const { session } = get()
    if (!session.authenticated) return false
    return session.permissions.includes(key)
  },
  hasAnyPermission: (keys) => keys.some((key) => get().hasPermission(key)),
  hasAllPermission: (keys) => {
    if (keys.length === 0) return false
    return keys.every((key) => get().hasPermission(key))
  }
}))
