import * as React from 'react'
import { FirstRunWizard } from '@/features/setup/FirstRunWizard'
import { Button } from '@/components/ui/button'
import { InlineMessage } from '@/components/ui/inline-message'
import { apiClient } from '@/services/apiClient'
import type { BackendServiceStatus } from '@shared/hardware'

type GateState = 'loading' | 'first-run' | 'offline' | 'ready'

/**
 * Gates the app on first-run completion and backend reachability.
 * Electron never starts PostgreSQL — only offers to start JumanApi service.
 */
export function DesktopGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = React.useState<GateState>('loading')
  const [svc, setSvc] = React.useState<BackendServiceStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const probe = React.useCallback(async () => {
    setError(null)
    try {
      if (import.meta.env.DEV || typeof window === 'undefined' || !window.juman) {
        setState('ready')
        return
      }
      const first = await apiClient.appExtras.getFirstRunState()
      if (!first.completed) {
        setState('first-run')
        return
      }
      try {
        await apiClient.system.health()
        setState('ready')
      } catch (err) {
        const status = await apiClient.hardware.backendStatus().catch(() => null)
        setSvc(status)
        setError(err instanceof Error ? err.message : 'الخادم غير متاح')
        setState('offline')
      }
    } catch {
      // Browser/dev without full bridge
      setState('ready')
    }
  }, [])

  React.useEffect(() => {
    void probe()
  }, [probe])

  if (state === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground" role="status">
        جاري التحميل…
      </div>
    )
  }

  if (state === 'first-run') {
    return <FirstRunWizard onCompleted={() => void probe()} />
  }

  if (state === 'offline') {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 p-8">
        <h1 className="text-title">تعذر الاتصال بالخادم</h1>
        {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}
        {svc ? (
          <p className="text-sm text-muted-foreground">
            خدمة {svc.serviceName}: {svc.state}
          </p>
        ) : null}
        <InlineMessage variant="info">
          التطبيق لا يشغّل PostgreSQL. تأكد أن خدمة PostgreSQL تعمل، ثم شغّل خدمة JumanApi.
        </InlineMessage>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void apiClient.hardware.startBackend().then(() => probe())
            }
          >
            تشغيل خدمة JumanApi
          </Button>
          <Button type="button" variant="outline" onClick={() => void apiClient.hardware.openLogs()}>
            فتح السجلات
          </Button>
          <Button type="button" variant="ghost" onClick={() => void probe()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
