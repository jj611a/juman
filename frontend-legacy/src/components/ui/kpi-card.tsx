import * as React from 'react'
import { Icon, type IconName } from '@/components/icons'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

export type KpiTrend = 'up' | 'down' | 'flat'

export interface KPICardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  value: React.ReactNode
  subtitle?: React.ReactNode
  trend?: KpiTrend
  trendLabel?: React.ReactNode
  icon?: IconName
  loading?: boolean
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  loading = false,
  className,
  ...props
}: KPICardProps): React.ReactElement {
  const trendClass =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-error'
        : 'text-base-content/50'

  return (
    <div
      className={cn(
        'stats stats-vertical w-full overflow-hidden rounded-box border border-base-content/10 bg-base-300 shadow-sm juman-elevate',
        className
      )}
      {...props}
    >
      <div className="stat gap-1 px-5 py-4">
        <div className="stat-title flex items-center justify-between gap-2 text-caption text-base-content/60">
          <span>{title}</span>
          {icon ? <Icon name={icon} size="sm" className="text-primary" /> : null}
        </div>
        {loading ? (
          <div className="flex h-10 items-center" role="status">
            <Spinner size="md" tone="muted" label={null} />
          </div>
        ) : (
          <>
            <div className="stat-value text-h2 text-base-content">{value}</div>
            {subtitle ? <div className="stat-desc text-caption text-base-content/55">{subtitle}</div> : null}
            {trendLabel || trend ? (
              <div className={cn('stat-desc text-caption', trendClass)}>
                {trendLabel ?? (trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→')}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
