import * as React from 'react'
import {
  AuditTimeline,
  BusyIndicator,
  EmptyState,
  ErrorState,
  SkeletonList
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useAuditLogsList } from '@/features/audit/hooks'
import { isV2Unsupported } from '@/services/v2/unsupported'

const RECENT_PARAMS = { offset: 0, limit: 10 } as const

export function DashboardRecentActivity(): React.ReactElement | null {
  const canView = usePermission('audit.view')
  const query = useAuditLogsList(RECENT_PARAMS, { enabled: canView })

  if (!canView) return null

  const rows = query.data?.data ?? []
  const unsupported = query.isError && isV2Unsupported(query.error)

  return (
    <section aria-labelledby="dash-activity-heading" className="space-y-4">
      <h2 id="dash-activity-heading" className="text-title text-base-content">
        النشاط الأخير
      </h2>
      <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
        {query.isLoading ? <SkeletonList items={5} /> : null}
        {query.isLoading ? <BusyIndicator label="جاري التحميل…" className="sr-only" /> : null}
        {unsupported ? (
          <EmptyState
            title="سجل التدقيق غير متاح"
            description="هذه الواجهة غير مربوطة بواجهة Nest V2 بعد"
          />
        ) : null}
        {query.isError && !unsupported ? (
          <ErrorState
            title="تعذر تحميل النشاط"
            message="تحقق من الاتصال ثم أعد المحاولة"
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {!query.isLoading && !query.isError && rows.length === 0 ? (
          <EmptyState title="لا يوجد نشاط" description="لم تُسجَّل أحداث تدقيق بعد" />
        ) : null}
        {rows.length > 0 ? (
          <AuditTimeline
            items={rows.map((row) => ({
              id: row.id,
              at: row.created_at,
              actor: row.username ?? undefined,
              action: row.action,
              detail: [row.module, row.entity_type, row.message].filter(Boolean).join(' · ') || undefined
            }))}
          />
        ) : null}
      </div>
    </section>
  )
}
