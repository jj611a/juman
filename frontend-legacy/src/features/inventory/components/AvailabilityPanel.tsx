import * as React from 'react'
import { InlineMessage } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'

/** Nest V2 has AvailabilityService internally but no calendar HTTP (ADR-V2-031). */
export function AvailabilityPanel({ dressId: _dressId }: { dressId: string }): React.ReactElement {
  const canView = usePermission('calendar.view')

  if (!canView) {
    return <InlineMessage variant="info">لا تملك صلاحية عرض التوفر</InlineMessage>
  }

  return (
    <section className="space-y-3">
      <h3 className="text-title text-foreground">توفر الفترة</h3>
      <InlineMessage variant="info">
        استعلام التوفر عبر واجهة التقويم غير متاح في Nest V2 — الخادم يرفض التعارض عند تأكيد الحجز
        أو التأجير.
      </InlineMessage>
    </section>
  )
}
