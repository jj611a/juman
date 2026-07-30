import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'

export interface StatisticsComparison {
  label: React.ReactNode
  value: React.ReactNode
  delta?: React.ReactNode
}

export interface StatisticsCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary summary values. */
  values: Array<{ label: React.ReactNode; value: React.ReactNode }>
  comparison?: StatisticsComparison
  /** Reserved for future mini charts (Phase later). */
  chartSlot?: React.ReactNode
  loading?: boolean
}

export function StatisticsCard({
  title,
  description,
  values,
  comparison,
  chartSlot,
  loading = false,
  className,
  ...props
}: StatisticsCardProps): React.ReactElement {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle className="text-title">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex h-16 items-center justify-center" role="status">
            <Spinner size="md" tone="muted" label={null} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {values.map((item, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-caption text-muted-foreground">{item.label}</span>
                  <span className="text-title text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
            {comparison ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
                <span className="text-caption text-muted-foreground">{comparison.label}</span>
                <span className="text-body text-foreground">{comparison.value}</span>
                {comparison.delta != null ? (
                  <span className="text-caption text-brand">{comparison.delta}</span>
                ) : null}
              </div>
            ) : null}
            {chartSlot ? <div className="min-h-16 border-t border-border pt-3">{chartSlot}</div> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
