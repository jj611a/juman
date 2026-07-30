import * as React from 'react'
import { Link } from 'react-router'
import {
  BusyIndicator,
  ErrorState,
  InlineMessage,
  StatusBadge
} from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import {
  useBackupsList,
  useSystemHealth,
  useSystemVersion
} from '@/features/system/hooks'

export function DashboardSystemStatus(): React.ReactElement | null {
  const canSystem = usePermission('system.view')
  const canBackup = useAnyPermission(['system.view', 'system.backup'])

  const health = useSystemHealth({ enabled: canSystem })
  const version = useSystemVersion({ enabled: canSystem })
  const backups = useBackupsList(
    { offset: 0, limit: 1, sort_by: 'created_at', sort_dir: 'desc' },
    { enabled: canBackup }
  )

  if (!canSystem && !canBackup) return null

  const loading = (canSystem && (health.isLoading || version.isLoading)) || (canBackup && backups.isLoading)
  const healthError = canSystem && health.isError
  const latestBackup = backups.data?.data?.[0]

  return (
    <section aria-labelledby="dash-system-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dash-system-heading" className="text-title text-foreground">
          حالة النظام
        </h2>
        {canSystem ? (
          <Link to="/system/status" className="text-caption text-brand hover:underline">
            التفاصيل
          </Link>
        ) : null}
      </div>

      {loading ? <BusyIndicator label="جاري التحميل…" /> : null}
      {healthError ? (
        <ErrorState title="تعذر تحميل الحالة" message="تحقق من الاتصال ثم أعد المحاولة" onRetry={() => void health.refetch()} />
      ) : null}

      <dl className="space-y-2 rounded-md border border-border p-3 text-sm">
        {canSystem && health.data ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">التطبيق</dt>
              <dd>
                <StatusBadge
                  tone={
                    String(health.data.status).toLowerCase() === 'ok' ||
                    String(health.data.status).toLowerCase() === 'healthy'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {String(health.data.status)}
                </StatusBadge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">قاعدة البيانات</dt>
              <dd className="text-foreground" dir="ltr">
                {String(health.data.database)}
              </dd>
            </div>
          </>
        ) : null}

        {canSystem && version.data ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">الإصدار</dt>
            <dd className="text-foreground" dir="ltr">
              {version.data.version}
              {version.data.api ? ` · API ${version.data.api}` : ''}
            </dd>
          </div>
        ) : null}

        {canBackup ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">النسخ الاحتياطي</dt>
            <dd className="text-foreground">
              {backups.isError ? (
                <InlineMessage variant="error">تعذر التحميل</InlineMessage>
              ) : latestBackup ? (
                <span dir="ltr">
                  {latestBackup.status}
                  {latestBackup.created_at
                    ? ` · ${new Date(latestBackup.created_at).toLocaleString('ar-IQ')}`
                    : ''}
                </span>
              ) : !backups.isLoading ? (
                <span className="text-muted-foreground">لا توجد نسخ</span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
