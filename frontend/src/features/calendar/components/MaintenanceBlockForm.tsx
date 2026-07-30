import * as React from 'react'
import { Button, DatePicker, TextInput } from '@/components/ui'
import { useCreateMaintenanceBlock } from '../hooks'

export function MaintenanceBlockForm({
  dressId,
  onCreated
}: {
  dressId: string
  onCreated?: () => void
}): React.ReactElement {
  const createMutation = useCreateMaintenanceBlock(dressId)
  const [start, setStart] = React.useState<Date | null>(null)
  const [end, setEnd] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState('')

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h3 className="text-title text-foreground">كتلة صيانة</h3>
      <p className="text-caption text-muted-foreground">
        يُنشأ فقط نوع MAINTENANCE — لا تُنشأ حجوزات/تأجير من التقويم.
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
        <TextInput
          className="max-w-xs"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات"
        />
        <Button
          type="button"
          disabled={!start || !end || createMutation.isPending}
          onClick={async () => {
            if (!start || !end) return
            const start_at = new Date(start)
            start_at.setHours(0, 0, 0, 0)
            const end_at = new Date(end)
            end_at.setHours(23, 59, 59, 999)
            await createMutation.mutateAsync({
              start_at: start_at.toISOString(),
              end_at: end_at.toISOString(),
              notes: notes.trim() || null
            })
            setNotes('')
            onCreated?.()
          }}
        >
          إضافة صيانة
        </Button>
      </div>
    </div>
  )
}
