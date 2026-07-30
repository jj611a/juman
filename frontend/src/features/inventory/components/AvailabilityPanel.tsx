import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, EmptyState, InlineMessage, BusyIndicator } from '@/components/ui'
import { apiClient } from '@/services/apiClient'
import { usePermission } from '@/hooks/usePermission'

export function AvailabilityPanel({ dressId }: { dressId: string }): React.ReactElement {
  const canView = usePermission('calendar.view')
  const [start, setStart] = React.useState<Date | null>(null)
  const [end, setEnd] = React.useState<Date | null>(null)
  const [submitted, setSubmitted] = React.useState<{ start_at: string; end_at: string } | null>(
    null
  )

  const availability = useQuery({
    queryKey: ['calendar', 'availability', dressId, submitted],
    queryFn: () => apiClient.calendar.availability(dressId, submitted!),
    enabled: Boolean(canView && submitted)
  })

  const conflicts = useQuery({
    queryKey: ['calendar', 'conflicts', dressId, submitted],
    queryFn: () => apiClient.calendar.conflicts(dressId, submitted!),
    enabled: Boolean(canView && submitted)
  })

  if (!canView) {
    return <InlineMessage variant="info">لا تملك صلاحية عرض التوفر</InlineMessage>
  }

  return (
    <section className="space-y-3">
      <h3 className="text-title text-foreground">توفر الفترة</h3>
      <p className="text-caption text-muted-foreground">
        النتيجة من واجهة التقويم فقط — لا يُحسب التوفر محلياً.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-caption text-muted-foreground">من</span>
          <DatePicker value={start} onChange={setStart} />
        </div>
        <div className="space-y-1">
          <span className="text-caption text-muted-foreground">إلى</span>
          <DatePicker value={end} onChange={setEnd} />
        </div>
        <Button
          type="button"
          disabled={!start || !end}
          onClick={() => {
            if (!start || !end) return
            const start_at = new Date(start)
            start_at.setHours(0, 0, 0, 0)
            const end_at = new Date(end)
            end_at.setHours(23, 59, 59, 999)
            setSubmitted({ start_at: start_at.toISOString(), end_at: end_at.toISOString() })
          }}
        >
          استعلام
        </Button>
      </div>
      {availability.isFetching ? <BusyIndicator label="جاري الاستعلام…" /> : null}
      {availability.data ? (
        <InlineMessage variant={availability.data.data.available ? 'success' : 'warning'}>
          {availability.data.data.available ? 'متاح في هذه الفترة' : 'غير متاح — توجد تعارضات'}
        </InlineMessage>
      ) : null}
      {conflicts.data && conflicts.data.data.conflicts.length > 0 ? (
        <ul className="space-y-1 text-caption text-muted-foreground">
          {conflicts.data.data.conflicts.map((c) => (
            <li key={c.block_id}>
              {c.block_type} · {new Date(c.start_at).toLocaleString('ar-IQ')} →{' '}
              {new Date(c.end_at).toLocaleString('ar-IQ')}
            </li>
          ))}
        </ul>
      ) : submitted && conflicts.isSuccess && conflicts.data?.data.conflicts.length === 0 ? (
        <EmptyState title="لا تعارضات" description="الفترة خالية حسب التقويم" />
      ) : null}
    </section>
  )
}
