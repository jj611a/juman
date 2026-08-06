import { ipcWindow } from '@/ipc/window'

export function WindowControls() {
  if (typeof window === 'undefined' || !window.juman?.window) {
    return null
  }
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <button
        type="button"
        className="btn btn-ghost btn-square btn-xs juman-focus"
        aria-label="تصغير"
        onClick={() => void ipcWindow.minimize()}
      >
        ─
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-square btn-xs juman-focus"
        aria-label="تكبير"
        onClick={() => void ipcWindow.maximize()}
      >
        □
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-square btn-xs juman-focus text-error"
        aria-label="إغلاق"
        onClick={() => void ipcWindow.close()}
      >
        ✕
      </button>
    </div>
  )
}
