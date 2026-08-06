import { useToast, type ToastTone } from '@/app/providers/ToastProvider'

const toneClass: Record<ToastTone, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
}

export function ToastHost() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="toast toast-start toast-bottom z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${toneClass[t.tone]} shadow-sm`}
          role="status"
        >
          <div>
            <p className="font-medium">{t.title}</p>
            {t.description ? (
              <p className="text-sm opacity-80">{t.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => dismiss(t.id)}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
