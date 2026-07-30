import * as React from 'react'
import { Icon, type IconName } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <Card className={cn(className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-caption font-medium text-muted-foreground">{title}</CardTitle>
        {icon ? <Icon name={icon} size="sm" className="text-brand" /> : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-10 items-center" role="status">
            <Spinner size="md" tone="muted" label={null} />
          </div>
        ) : (
          <>
            <p className="text-h2 text-foreground">{value}</p>
            {subtitle ? (
              <p className="mt-1 text-caption text-muted-foreground">{subtitle}</p>
            ) : null}
            {trendLabel || trend ? (
              <p className={cn('mt-1 text-caption', trendClass)}>
                {trendLabel ?? (trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→')}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
