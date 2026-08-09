import type { StartupStatus } from '@shared/startup'
import { APP_NAME_AR } from '@/shared/constants/app'
import { JUMAN_LOGO_SRC } from '@/shared/components/AppLogo'
import { STARTUP_FAILED_HINT, STARTUP_TIMEOUT_HINT } from '../startup.types'

interface StartupSplashProps {
  status: StartupStatus | null
  onRetry?: () => void
  onQuit?: () => void
}

/**
 * Full-screen splash shown while Main is booting the backend / restoring the
 * session. Only receives the sanitized StartupStatus — never backend internals.
 */
export function StartupSplash({ status, onRetry, onQuit }: StartupSplashProps) {
  const terminal = status?.state === 'failed' || status?.state === 'timeout'
  const message = status?.message ?? 'جاري تشغيل النظام...'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-base-100 px-6 text-base-content">
      <div className="flex flex-col items-center gap-5">
        <img
          src={JUMAN_LOGO_SRC}
          alt={APP_NAME_AR}
          className="h-20 w-auto"
          draggable={false}
        />
        <h1 className="font-semibold tracking-wide text-primary text-2xl">{APP_NAME_AR}</h1>
      </div>

      {terminal ? (
        <div className="w-full max-w-sm rounded-box border border-base-content/10 bg-base-200 p-6 text-center">
          <p className="font-medium" role="status" aria-live="polite">
            {status?.message}
          </p>
          <p className="mt-2 text-sm text-base-content/70">
            {status?.state === 'timeout' ? STARTUP_TIMEOUT_HINT : STARTUP_FAILED_HINT}
          </p>

          {status?.errorCode ? (
            <details className="mt-4 text-start text-xs text-base-content/60">
              <summary className="cursor-pointer text-primary">تفاصيل التشخيص</summary>
              <div className="mt-2 rounded-field bg-base-300 p-3 font-mono" dir="ltr">
                {status.errorCode}
              </div>
            </details>
          ) : null}

          <div className="mt-6 flex items-center justify-center gap-3">
            <button className="btn btn-primary" onClick={onRetry} autoFocus>
              إعادة المحاولة
            </button>
            <button className="btn btn-ghost" onClick={onQuit}>
              إغلاق التطبيق
            </button>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className="text-sm text-base-content/70" role="status" aria-live="polite">
            {message}
          </p>
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-base-300" aria-hidden="true">
            <div className="juman-splash-bar absolute inset-y-0 w-1/3 rounded-full bg-primary" />
          </div>
          {status ? (
            <p className="text-xs text-base-content/40">
              المحاولة {status.attempt} · {Math.max(1, Math.round(status.elapsedMs / 1000))} ث
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
