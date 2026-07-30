export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export interface ToastActionConfig {
  label: string
  onClick: () => void
  altText?: string
}

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: ToastActionConfig
}

export interface ToastRecord extends Required<Pick<ToastInput, 'title' | 'variant' | 'duration'>> {
  id: string
  description?: string
  action?: ToastActionConfig
}

export const TOAST_MAX_VISIBLE = 3
export const TOAST_DEFAULT_DURATION = 5000

type Listener = () => void

let queue: ToastRecord[] = []
let visible: ToastRecord[] = []
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((l) => l())
}

function promote(): void {
  while (visible.length < TOAST_MAX_VISIBLE && queue.length > 0) {
    visible = [...visible, queue[0]!]
    queue = queue.slice(1)
  }
}

export function getToastSnapshot(): { visible: ToastRecord[]; queued: number } {
  return { visible, queued: queue.length }
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function enqueueToast(input: ToastInput): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record: ToastRecord = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'info',
    duration: input.duration ?? TOAST_DEFAULT_DURATION,
    action: input.action
  }
  queue = [...queue, record]
  promote()
  notify()
  return id
}

export function dismissToast(id: string): void {
  const wasVisible = visible.some((t) => t.id === id)
  visible = visible.filter((t) => t.id !== id)
  queue = queue.filter((t) => t.id !== id)
  if (wasVisible) promote()
  notify()
}

export function clearToasts(): void {
  visible = []
  queue = []
  notify()
}

type ToastFn = {
  (input: ToastInput | string): string
  success: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  info: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  warning: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  error: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

function callToast(input: ToastInput | string): string {
  if (typeof input === 'string') return enqueueToast({ title: input })
  return enqueueToast(input)
}

export const toast: ToastFn = Object.assign(callToast, {
  success: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
    enqueueToast({ ...opts, title, variant: 'success' }),
  info: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
    enqueueToast({ ...opts, title, variant: 'info' }),
  warning: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
    enqueueToast({ ...opts, title, variant: 'warning' }),
  error: (title: string, opts?: Omit<ToastInput, 'title' | 'variant'>) =>
    enqueueToast({ ...opts, title, variant: 'error' }),
  dismiss: dismissToast,
  clear: clearToasts
})

/** Alias of `toast` — checklist / notification-service naming. Prefer either; same singleton. */
export const notification = toast
