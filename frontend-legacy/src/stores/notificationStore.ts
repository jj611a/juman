import { create } from 'zustand'

export interface AppNotification {
  id: string
  title: string
  description?: string
  variant?: 'info' | 'success' | 'error'
}

interface NotificationState {
  items: AppNotification[]
  push: (item: Omit<AppNotification, 'id'> & { id?: string }) => void
  dismiss: (id: string) => void
  clear: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  push: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        { id: item.id ?? crypto.randomUUID(), title: item.title, description: item.description, variant: item.variant }
      ]
    })),
  dismiss: (id) => set((state) => ({ items: state.items.filter((n) => n.id !== id) })),
  clear: () => set({ items: [] })
}))
