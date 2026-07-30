import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  BusyIndicator,
  Button,
  DatePicker,
  ErrorState,
  MoneyInput,
  Page,
  PageHeader,
  TextInput
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { AvailabilityPreview } from '../components/AvailabilityPreview'
import { useReservation, useUpdateReservation } from '../hooks'
import { emptyToNull, toIsoDateTime } from '../schemas'

export default function ReservationEditPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const canUpdate = usePermission('reservation.update')
  const navigate = useNavigate()
  const detail = useReservation(id)
  const updateMutation = useUpdateReservation(id ?? '')
  const [dirty, setDirty] = React.useState(false)
  const { dialog } = useUnsavedChangesGuard(dirty)

  const reservation = detail.data?.data
  const [rentalStart, setRentalStart] = React.useState<Date | null>(null)
  const [expectedReturn, setExpectedReturn] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState('')
  const [prices, setPrices] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    if (!reservation) return
    setRentalStart(new Date(reservation.rental_start_at))
    setExpectedReturn(new Date(reservation.expected_return_at))
    setNotes(reservation.notes ?? '')
    const p: Record<string, number> = {}
    for (const it of reservation.items) p[it.dress_id] = it.reserved_daily_rental_price
    setPrices(p)
    setDirty(false)
  }, [reservation])

  if (!canUpdate) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/reservations" replace />

  if (detail.isSuccess && reservation && reservation.status !== 'DRAFT') {
    return <Navigate to={`/reservations/${id}`} replace />
  }

  const startIso = rentalStart
    ? (() => {
        const d = new Date(rentalStart)
        d.setHours(0, 0, 0, 0)
        return d.toISOString()
      })()
    : null
  const endIso = expectedReturn
    ? (() => {
        const d = new Date(expectedReturn)
        d.setHours(23, 59, 59, 999)
        return d.toISOString()
      })()
    : null

  return (
    <Page size="md" as="main">
      <PageHeader title="تعديل الحجز" description="مسودة فقط" />
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !reservation ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <span className="text-caption text-muted-foreground">بداية الإيجار</span>
              <DatePicker
                value={rentalStart}
                onChange={(d) => {
                  setRentalStart(d)
                  setDirty(true)
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-caption text-muted-foreground">الإعادة المتوقعة</span>
              <DatePicker
                value={expectedReturn}
                onChange={(d) => {
                  setExpectedReturn(d)
                  setDirty(true)
                }}
              />
            </div>
          </div>
          <TextInput
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setDirty(true)
            }}
            placeholder="ملاحظات"
          />
          <ul className="space-y-3">
            {reservation.items.map((it) => (
              <li key={it.id} className="rounded-md border border-border p-3">
                <p className="mb-2 text-caption text-muted-foreground" dir="ltr">
                  {it.dress_id}
                </p>
                <MoneyInput
                  value={prices[it.dress_id] ?? it.reserved_daily_rental_price}
                  onChange={(v) => {
                    setPrices((prev) => ({ ...prev, [it.dress_id]: v ?? 0 }))
                    setDirty(true)
                  }}
                  label="السعر اليومي"
                />
              </li>
            ))}
          </ul>
          <AvailabilityPreview
            dressIds={reservation.items.map((i) => i.dress_id)}
            startAt={startIso}
            endAt={endIso}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!rentalStart || !expectedReturn || updateMutation.isPending}
              onClick={async () => {
                if (!rentalStart || !expectedReturn) return
                const start = new Date(rentalStart)
                start.setHours(0, 0, 0, 0)
                const end = new Date(expectedReturn)
                end.setHours(23, 59, 59, 999)
                await updateMutation.mutateAsync({
                  rental_start_at: toIsoDateTime(start),
                  expected_return_at: toIsoDateTime(end),
                  notes: emptyToNull(notes),
                  clear_notes: !notes.trim(),
                  items: reservation.items.map((it) => ({
                    dress_id: it.dress_id,
                    reserved_daily_rental_price: prices[it.dress_id] ?? it.reserved_daily_rental_price,
                    notes: it.notes
                  }))
                })
                setDirty(false)
                void navigate(`/reservations/${id}`)
              }}
            >
              حفظ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate(`/reservations/${id}`)}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}
      {dialog}
    </Page>
  )
}
