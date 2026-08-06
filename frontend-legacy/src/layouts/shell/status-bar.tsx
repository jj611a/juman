import * as React from 'react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

export interface StatusBarProps extends React.HTMLAttributes<HTMLElement> {
  online?: boolean
  appVersion?: string
  backendVersion?: string
}

export function StatusBar({
  online = true,
  appVersion,
  backendVersion,
  className,
  ...props
}: StatusBarProps): React.ReactElement {
  const user = useAuthStore((s) => s.session.user)
  const name = user?.full_name || user?.username

  return (
    <footer
      className={cn(
        'flex items-center justify-between gap-3 border-t border-base-content/10 bg-neutral px-4 py-1.5 text-caption text-base-content/55',
        className
      )}
      role="contentinfo"
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('inline-flex items-center gap-1.5', online ? 'text-success' : 'text-error')}>
          <span className={cn('status status-sm', online ? 'status-success' : 'status-error')} />
          {online ? 'متصل' : 'غير متصل'}
        </span>
        {name ? <span className="badge badge-ghost badge-sm truncate font-normal">{name}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {appVersion ? <span className="badge badge-outline badge-sm">التطبيق {appVersion}</span> : null}
        {backendVersion ? <span className="badge badge-outline badge-sm">الخادم {backendVersion}</span> : null}
      </div>
    </footer>
  )
}
