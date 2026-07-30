import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  BusyIndicator,
  Button,
  EntityHeader,
  ErrorState,
  Page,
  RecordInfoPanel
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useAuditLog } from '../hooks'

function JsonBlock({ label, value }: { label: string; value: unknown }): React.ReactElement {
  const text = value == null || value === '' ? '—' : JSON.stringify(value, null, 2)
  return (
    <section className="space-y-2">
      <h3 className="text-title text-foreground">{label}</h3>
      <pre
        className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-4 text-xs text-foreground"
        dir="ltr"
      >
        {text}
      </pre>
    </section>
  )
}

export default function AuditDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('audit.view')
  const detail = useAuditLog(id)
  const log = detail.data?.data

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/audit" replace />

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !log ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={log.action}
            description={log.message ?? `${log.module} · ${log.entity_type}`}
            actions={
              <Button type="button" variant="outline" onClick={() => void navigate('/audit')}>
                العودة للسجل
              </Button>
            }
          />

          <RecordInfoPanel
            title="البيانات الأساسية"
            metaItems={[
              { id: 'id', label: 'المعرّف', value: log.id },
              { id: 'module', label: 'الوحدة', value: log.module },
              { id: 'entity_type', label: 'نوع الكيان', value: log.entity_type },
              {
                id: 'entity_id',
                label: 'معرّف الكيان',
                value: log.entity_id ?? '—'
              },
              { id: 'action', label: 'الإجراء', value: log.action },
              {
                id: 'username',
                label: 'المستخدم',
                value: log.username ?? '—'
              },
              {
                id: 'user_id',
                label: 'معرّف المستخدم',
                value: log.user_id ?? '—'
              },
              {
                id: 'ip',
                label: 'عنوان IP',
                value: log.ip_address ?? '—'
              },
              {
                id: 'created_at',
                label: 'الوقت',
                value: new Date(log.created_at).toLocaleString('ar-IQ')
              },
              {
                id: 'message',
                label: 'الرسالة',
                value: log.message ?? '—'
              }
            ]}
          />

          <JsonBlock label="القيم السابقة (old_values)" value={log.old_values} />
          <JsonBlock label="القيم الجديدة (new_values)" value={log.new_values} />
          <JsonBlock label="البيانات الوصفية (metadata)" value={log.metadata} />
        </div>
      )}
    </Page>
  )
}
