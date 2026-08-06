import * as React from 'react'
import { InlineMessage } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'

/**
 * Nest V2 has no calendar.availability HTTP. Server-side AvailabilityService still
 * enforces conflicts on confirm/checkout — preview is informational only.
 */
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

  React.useEffect(() => {
    // Do not block confirm/create — Nest enforces availability on the write path.
    onAllAvailableChange?.(null)
  }, [onAllAvailableChange])

  if (!canView) {
    return <InlineMessage variant="info">لا تملك صلاحية عرض التوفر</InlineMessage>
  }
  if (!startAt || !endAt || dressIds.length === 0) {
    return <InlineMessage variant="info">حدد الفساتين والفترة لمعاينة التوفر</InlineMessage>
  }

  return (
    <section className="space-y-3">
      <h3 className="text-title text-foreground">معاينة التوفر</h3>
      <InlineMessage variant="info">
        معاينة التقويم غير متاحة في Nest V2. يمكن حفظ المسودة والتأكيد؛ الخادم يرفض التأكيد عند وجود
        تعارض.
      </InlineMessage>
    </section>
  )
}
