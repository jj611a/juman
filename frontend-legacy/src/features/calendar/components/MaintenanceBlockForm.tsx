import * as React from 'react'
import { InlineMessage } from '@/components/ui'

/** Maintenance calendar blocks require calendar HTTP — not present in Nest V2. */
export function MaintenanceBlockForm({
  dressId: _dressId
}: {
  dressId: string
  onCreated?: () => void
}): React.ReactElement {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h3 className="text-title text-foreground">كتلة صيانة</h3>
      <InlineMessage variant="info">
        إنشاء كتل الصيانة عبر التقويم غير متاح في Nest V2. استخدم انتقال حالة المخزون (صيانة) عند
        الحاجة.
      </InlineMessage>
    </div>
  )
}
