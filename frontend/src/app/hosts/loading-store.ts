type Listener = () => void

let count = 0
let label: string | undefined
let snapshot: { active: boolean; label?: string } = { active: false }
const listeners = new Set<Listener>()

function emit(): void {
  snapshot = { active: count > 0, label }
  listeners.forEach((l) => l())
}

export const globalLoading = {
  show(nextLabel?: string): void {
    count += 1
    if (nextLabel) label = nextLabel
    emit()
  },
  hide(): void {
    if (count === 0) return
    count = Math.max(0, count - 1)
    if (count === 0) label = undefined
    emit()
  },
  getSnapshot(): { active: boolean; label?: string } {
    // Stable identity until emit — required by useSyncExternalStore.
    return snapshot
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}
