import * as React from 'react'
import {
  Button,
  ConfirmationDialog,
  DatePicker,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  InlineMessage,
  TextInput
} from '@/components/ui'
import type { CalendarBlockDto } from '@/services/domainTypes'
import { usePermission } from '@/hooks/usePermission'
import { BLOCK_TYPE_LABELS } from '../blockColors'
import { useDeleteCalendarBlock, useUpdateCalendarBlock } from '../hooks'

const BOOKING_MODULES = new Set(['reservation', 'rental', 'processing', 'reservations', 'rentals'])

export interface BlockDetailDrawerProps {
  block: CalendarBlockDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BlockDetailDrawer({
  block,
  open,
  onOpenChange
}: BlockDetailDrawerProps): React.ReactElement {
  const canManage = usePermission('calendar.manage')
  const updateMutation = useUpdateCalendarBlock()
  const deleteMutation = useDeleteCalendarBlock()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [start, setStart] = React.useState<Date | null>(null)
  const [end, setEnd] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState('')

  React.useEffect(() => {
    if (!block) return
    setStart(new Date(block.start_at))
    setEnd(new Date(block.end_at))
    setNotes(block.notes ?? '')
    setEditMode(false)
  }, [block])

  const isMaintenance = block?.block_type === 'MAINTENANCE'
  const refModule = (block?.reference_module ?? '').toLowerCase()
  const isBookingRef = BOOKING_MODULES.has(refModule) || ['RESERVATION', 'RENTAL', 'PROCESSING'].includes(
    block?.block_type ?? ''
  )

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="left" size="sm">
          <DrawerHeader>
            <DrawerTitle>
              {block ? BLOCK_TYPE_LABELS[block.block_type] ?? block.block_type : 'كتلة'}
            </DrawerTitle>
            <DrawerDescription>تفاصيل كتلة التقويم</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            {block ? (
              <>
                <dl className="space-y-2 text-body">
                  <div>
                    <dt className="text-caption text-muted-foreground">من</dt>
                    <dd>{new Date(block.start_at).toLocaleString('ar-IQ')}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">إلى</dt>
                    <dd>{new Date(block.end_at).toLocaleString('ar-IQ')}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">ملاحظات</dt>
                    <dd>{block.notes ?? '—'}</dd>
                  </div>
                  {block.reference_module || block.reference_id ? (
                    <div>
                      <dt className="text-caption text-muted-foreground">مرجع</dt>
                      <dd dir="ltr" className="text-caption">
                        {block.reference_module ?? '—'} / {block.reference_id ?? '—'}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {isBookingRef && !isMaintenance ? (
                  <InlineMessage variant="info">
                    وحدة الواجهة لاحقاً — الحجوزات/التأجير/المعالجة غير مبنية بعد.
                  </InlineMessage>
                ) : null}
                {canManage && isMaintenance && editMode ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-caption text-muted-foreground">من</span>
                      <DatePicker value={start} onChange={setStart} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-caption text-muted-foreground">إلى</span>
                      <DatePicker value={end} onChange={setEnd} />
                    </div>
                    <TextInput
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="ملاحظات"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </DrawerBody>
          <DrawerFooter>
            {canManage && isMaintenance ? (
              <div className="flex flex-wrap gap-2">
                {editMode ? (
                  <Button
                    type="button"
                    disabled={!start || !end || updateMutation.isPending}
                    onClick={async () => {
                      if (!block || !start || !end) return
                      const start_at = new Date(start)
                      start_at.setHours(0, 0, 0, 0)
                      const end_at = new Date(end)
                      end_at.setHours(23, 59, 59, 999)
                      await updateMutation.mutateAsync({
                        id: block.id,
                        body: {
                          start_at: start_at.toISOString(),
                          end_at: end_at.toISOString(),
                          notes: notes.trim() || null,
                          clear_notes: !notes.trim()
                        }
                      })
                      setEditMode(false)
                      onOpenChange(false)
                    }}
                  >
                    حفظ
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => setEditMode(true)}>
                    تعديل
                  </Button>
                )}
                <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                  حذف
                </Button>
              </div>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف كتلة الصيانة؟"
        description="لا يمكن التراجع من الواجهة."
        confirmLabel="حذف"
        tone="danger"
        onConfirm={async () => {
          if (!block) return
          await deleteMutation.mutateAsync(block.id)
          setDeleteOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
