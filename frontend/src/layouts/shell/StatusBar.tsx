import { useSession } from '@/app/providers/SessionProvider'
import { useBackendHealth } from '@/shared/hooks/useBackendHealth'
import { APP_VERSION } from '@/shared/constants/app'
import { cn } from '@/shared/utils/cn'

export function StatusBar() {
  const { session } = useSession()
  const health = useBackendHealth()
  const online = health.isSuccess && health.data?.status === 'ok'
  const user = session?.user

  return (
    <footer className="flex items-center justify-between gap-3 border-t border-base-content/10 bg-base-200/80 px-4 py-1.5 text-xs text-base-content/55 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span
          className={cn('status', online ? 'status-success' : 'status-error')}
          title={online ? 'الخادم متصل' : 'الخادم غير متصل'}
        />
        <span>
          الخادم:{' '}
          {health.isLoading
            ? '…'
            : online
              ? 'متصل'
              : health.isError
                ? 'منقطع'
                : String(health.data?.status ?? '—')}
        </span>
        {health.data?.version ? (
          <span className="opacity-60" dir="ltr">
            API {health.data.version}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span title="الجلسة">
          {user
            ? `${user.displayName ?? user.username}`
            : 'بدون جلسة'}
        </span>
        <span className="opacity-50" dir="ltr">
          {APP_VERSION}
        </span>
      </div>
    </footer>
  )
}
