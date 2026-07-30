import type { ReactNode } from 'react'

export interface DialogHostState {
  open: boolean
  title?: ReactNode
  description?: ReactNode
  content?: ReactNode
  onOpenChange?: (open: boolean) => void
}

type Listener = () => void

let state: DialogHostState = { open: false }
const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach((l) => l())
}

export const dialogHost = {
  open(next: Omit<DialogHostState, 'open'>): void {
    state = { ...next, open: true }
    emit()
  },
  close(): void {
    // Idempotent: a new snapshot + emit while already closed loops with Radix onOpenChange.
    if (!state.open) return
    state = { ...state, open: false }
    emit()
  },
  getSnapshot(): DialogHostState {
    return state
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}
