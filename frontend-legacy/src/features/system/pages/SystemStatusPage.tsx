import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  StatusBadge,
  StatusChip,
  mapStatus
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { diagnosticsOverall } from '../api'
import {
  useSystemDiagnostics,
  useSystemHealth,
  useSystemInfo,
  useSystemMetrics,
  useSystemVersion
} from '../hooks'
import {
  CHECK_STATUS_MAP,
  DIAGNOSTICS_OVERALL_MAP,
  HEALTH_STATUS_MAP,
  SERVICE_STATUS_MAP
} from '../statusMap'

function JsonPanel({ title, value }: { title: string; value: unknown }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-80 overflow-auto text-xs text-muted-foreground" dir="ltr">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

export default function SystemStatusPage(): React.ReactElement {
  const canView = usePermission('system.view')
  const health = useSystemHealth({ enabled: canView })
  const version = useSystemVersion({ enabled: canView })
  const info = useSystemInfo({ enabled: canView })
  const diagnostics = useSystemDiagnostics({ enabled: canView })
  const metrics = useSystemMetrics({ enabled: canView })

  if (!canView) return <Navigate to="/forbidden" replace />

  const healthData = health.data
  const dbStatus = String(healthData?.database ?? 'unknown')
  const redisStatus = String(healthData?.redis ?? 'unknown')
  const overallHealth = String(healthData?.status ?? 'unknown')
  const readiness = diagnostics.data ? diagnosticsOverall(diagnostics.data) : 'unknown'
  const readinessMapped = mapStatus(readiness, DIAGNOSTICS_OVERALL_MAP)
  const checks = Array.isArray(
    (diagnostics.data as unknown as { checks?: unknown[] } | undefined)?.checks
  )
    ? ((diagnostics.data as unknown as { checks: Array<Record<string, unknown>> }).checks ?? [])
    : []

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-3">
        <StatusBadge tone={readinessMapped.tone}>
          جاهزية الإنتاج: {readinessMapped.label}
        </StatusBadge>
        {healthData ? (
          <>
            <StatusChip status={overallHealth} map={HEALTH_STATUS_MAP} />
            <StatusBadge tone={mapStatus(dbStatus, SERVICE_STATUS_MAP).tone}>
              قاعدة البيانات: {mapStatus(dbStatus, SERVICE_STATUS_MAP).label}
            </StatusBadge>
            <StatusBadge tone={mapStatus(redisStatus, SERVICE_STATUS_MAP).tone}>
              Redis: {mapStatus(redisStatus, SERVICE_STATUS_MAP).label}
            </StatusBadge>
          </>
        ) : null}
      </section>

      {health.isLoading || version.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : null}

      {health.isError ? (
        <ErrorState title="تعذر تحميل health" onRetry={() => void health.refetch()} />
      ) : healthData ? (
        <JsonPanel title="health" value={healthData} />
      ) : null}

      {version.isError ? (
        <ErrorState title="تعذر تحميل version" onRetry={() => void version.refetch()} />
      ) : version.data ? (
        <JsonPanel title="version" value={version.data} />
      ) : null}

      {info.isError ? (
        <ErrorState title="تعذر تحميل info" onRetry={() => void info.refetch()} />
      ) : info.data ? (
        <JsonPanel title="info" value={info.data} />
      ) : null}

      {diagnostics.isError ? (
        <ErrorState title="تعذر تحميل diagnostics" onRetry={() => void diagnostics.refetch()} />
      ) : diagnostics.data ? (
        <div className="space-y-4">
          <JsonPanel title="diagnostics" value={diagnostics.data} />
          {checks.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>فحوصات التشخيص</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {checks.map((check) => {
                    const status = String(check.status ?? 'unknown')
                    const mapped = mapStatus(status, CHECK_STATUS_MAP)
                    return (
                      <li
                        key={String(check.id ?? check.message)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                      >
                        <span className="text-body">{String(check.id ?? '—')}</span>
                        <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
                        <span className="w-full text-caption text-muted-foreground">
                          {String(check.message ?? '')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {metrics.isError ? (
        <ErrorState title="تعذر تحميل metrics" onRetry={() => void metrics.refetch()} />
      ) : metrics.data ? (
        <JsonPanel title="metrics" value={metrics.data} />
      ) : null}
    </div>
  )
}
