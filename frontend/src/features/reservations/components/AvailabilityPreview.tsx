import * as React from 'react'
import { useQueries } from '@tanstack/react-query'
import { BusyIndicator, InlineMessage } from '@/components/ui'
import { apiClient } from '@/services/apiClient'
import { usePermission } from '@/hooks/usePermission'

export function AvailabilityPreview({
  dressIds,
  startAt,
  endAt,
  onAllAvailableChange
}: {
  dressIds: string[]
  startAt: string | null
  endAt: string | null
  onAllAvailableChange?: (allAvailable: boolean | null) => void
}): React.ReactElement {
  const canView = usePermission('calendar.view')
  const enabled = Boolean(canView && startAt && endAt && dressIds.length > 0)

  const queries = useQueries({
    queries: dressIds.map((dressId) => ({
      queryKey: ['calendar', 'availability', dressId, startAt, endAt],
      queryFn: () =>
        apiClient.calendar.availability(dressId, { start_at: startAt!, end_at: endAt! }),
      enabled
    }))
  })

  const conflictQueries = useQueries({
    queries: dressIds.map((dressId) => ({
      queryKey: ['calendar', 'conflicts', dressId, startAt, endAt],
      queryFn: () =>
        apiClient.calendar.conflicts(dressId, { start_at: startAt!, end_at: endAt! }),
      enabled
    }))
  })

  const loading = queries.some((q) => q.isFetching)
  const allReady = enabled && queries.every((q) => q.isSuccess)
  const allAvailable = allReady ? queries.every((q) => q.data?.data.available) : null

  React.useEffect(() => {
    onAllAvailableChange?.(allAvailable)
  }, [allAvailable, onAllAvailableChange])

  if (!canView) {
    return <InlineMessage variant="info">لا تملك صلاحية عرض التوفر</InlineMessage>
  }
  if (!startAt || !endAt || dressIds.length === 0) {
    return <InlineMessage variant="info">حدد الفساتين والفترة لمعاينة التوفر</InlineMessage>
  }

  return (
    <section className="space-y-3">
      <h3 className="text-title text-foreground">معاينة التوفر</h3>
      <p className="text-caption text-muted-foreground">
        من واجهة التقويم فقط — المسودة مسموحة حتى مع التعارض؛ التأكيد يتطلب التوفر.
      </p>
      {loading ? <BusyIndicator label="جاري الاستعلام…" /> : null}
      {allAvailable === true ? (
        <InlineMessage variant="success">جميع الفساتين متاحة في هذه الفترة</InlineMessage>
      ) : null}
      {allAvailable === false ? (
        <InlineMessage variant="warning">
          توجد تعارضات — يمكن حفظ مسودة، لكن التأكيد سيُرفض حتى تُحل.
        </InlineMessage>
      ) : null}
      <ul className="space-y-2 text-caption">
        {dressIds.map((id, i) => {
          const av = queries[i]?.data?.data
          const conflicts = conflictQueries[i]?.data?.data.conflicts ?? []
          return (
            <li key={id} className="rounded-md border border-border p-2">
              <span dir="ltr" className="text-muted-foreground">
                {id.slice(0, 8)}…
              </span>
              {av ? (
                <span className="ms-2">{av.available ? 'متاح' : 'غير متاح'}</span>
              ) : null}
              {conflicts.length > 0 ? (
                <ul className="mt-1 text-muted-foreground">
                  {conflicts.map((c) => (
                    <li key={c.block_id}>
                      {c.block_type} · {new Date(c.start_at).toLocaleString('ar-IQ')}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
