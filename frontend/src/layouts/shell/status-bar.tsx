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
        'flex items-center justify-between gap-3 border-t border-border bg-header px-4 py-1.5 text-caption text-muted-foreground',
        className
      )}
      role="contentinfo"
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn('inline-flex items-center gap-1.5', online ? 'text-success' : 'text-destructive')}
        >
          <span
            aria-hidden
            className={cn('size-1.5 rounded-full', online ? 'bg-success' : 'bg-destructive')}
          />
          {online ? 'متصل' : 'غير متصل'}
        </span>
        {name ? <span className="truncate">{name}</span> : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {appVersion ? <span>التطبيق {appVersion}</span> : null}
        {backendVersion ? <span>الخادم {backendVersion}</span> : null}
      </div>
    </footer>
  )
}
