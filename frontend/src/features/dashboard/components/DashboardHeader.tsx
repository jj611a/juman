import * as React from 'react'
import { StatusBadge } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/usePermission'
import { useSetting } from '@/features/settings/hooks'
import { useSystemHealth } from '@/features/system/hooks'
import { useDashboardReport } from '@/features/reports/hooks'

export function DashboardHeader(): React.ReactElement {
  const session = useAuthStore((s) => s.session)
  const canReports = usePermission('reports.view')
  const canSettings = usePermission('settings.view')
  const dash = useDashboardReport(canReports)
  const company = useSetting(canSettings ? 'company_name' : undefined)
  const health = useSystemHealth({ enabled: true })

  const userLabel =
    session.user?.full_name?.trim() || session.user?.username || '—'
  const companyName =
    canSettings && company.data?.value ? company.data.value : null

  const asOf = dash.data?.as_of
  const tz = dash.data?.timezone

  let connectionTone: 'success' | 'danger' | 'warning' | 'neutral' = 'neutral'
  let connectionLabel = 'جاري التحقق…'
  if (health.isLoading) {
    connectionTone = 'warning'
    connectionLabel = 'جاري التحقق…'
  } else if (health.isError) {
    connectionTone = 'danger'
    connectionLabel = 'غير متصل'
  } else if (health.data) {
    const st = String(health.data.status ?? '').toLowerCase()
    if (st === 'ok' || st === 'healthy' || st === 'up') {
      connectionTone = 'success'
      connectionLabel = 'متصل'
    } else {
      connectionTone = 'warning'
      connectionLabel = String(health.data.status ?? 'حالة غير معروفة')
    }
  }

  return (
    <header className="space-y-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display text-foreground">مرحباً، {userLabel}</h1>
          {companyName ? (
            <p className="text-body text-muted-foreground">{companyName}</p>
          ) : null}
        </div>
        <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
      </div>
      {asOf ? (
        <p className="text-caption text-muted-foreground" dir="ltr">
          {new Date(asOf).toLocaleString('ar-IQ')}
          {tz ? ` · ${tz}` : ''}
        </p>
      ) : (
        <p className="text-caption text-muted-foreground">لوحة التشغيل</p>
      )}
    </header>
  )
}
