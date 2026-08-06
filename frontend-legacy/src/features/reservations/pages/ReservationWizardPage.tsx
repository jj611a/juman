import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  InlineMessage,
  MoneyDisplay,
  MoneyInput,
  Page,
  PageHeader,
  SearchBar,
  TextInput
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { AvailabilityPreview } from '../components/AvailabilityPreview'
import { WizardSteps } from '../components/WizardSteps'
import { useConfirmReservation, useCreateReservation } from '../hooks'
import { emptyToNull, toIsoDateTime } from '../schemas'

const STEPS = ['العميل', 'الفساتين', 'التواريخ', 'التوفر', 'الملخص', 'الإنشاء']

type ItemDraft = {
  dress_id: string
  name_ar: string
  reserved_daily_rental_price: number | null
  notes: string
}

export default function ReservationWizardPage(): React.ReactElement {
  const canCreate = useAnyPermission(['reservation.create', 'reservations.create'])
  const canConfirm = useAnyPermission(['reservation.update', 'reservations.create'])
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [customerLabel, setCustomerLabel] = React.useState('')
  const [dressQ, setDressQ] = React.useState('')
  const [items, setItems] = React.useState<ItemDraft[]>([])
  const [rentalStart, setRentalStart] = React.useState<Date | null>(null)
  const [expectedReturn, setExpectedReturn] = React.useState<Date | null>(null)
  const [reservationAt, setReservationAt] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState('')
  const [allAvailable, setAllAvailable] = React.useState<boolean | null>(null)

  const createMutation = useCreateReservation()
  const confirmMutation = useConfirmReservation()

  const customers = useQuery({
    queryKey: ['customers', 'list', { q: customerQ, limit: 20 }],
    queryFn: () => apiClient.customers.list({ q: customerQ || undefined, limit: 20 }),
    enabled: step === 0 && customerQ.trim().length >= 1
  })

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { q: dressQ, page: 1, page_size: 20, is_active: true }],
    queryFn: () =>
      apiClient.dresses.list({
        q: dressQ || undefined,
        page: 1,
        page_size: 20,
        is_active: true
      }),
    enabled: step === 1
  })

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const startIso =
    rentalStart != null
      ? (() => {
          const d = new Date(rentalStart)
          d.setHours(0, 0, 0, 0)
          return d.toISOString()
        })()
      : null
  const endIso =
    expectedReturn != null
      ? (() => {
          const d = new Date(expectedReturn)
          d.setHours(23, 59, 59, 999)
          return d.toISOString()
        })()
      : null

  const canNext =
    (step === 0 && Boolean(customerId)) ||
    (step === 1 && items.length > 0) ||
    (step === 2 &&
      rentalStart != null &&
      expectedReturn != null &&
      expectedReturn.getTime() > rentalStart.getTime()) ||
    step === 3 ||
    step === 4

  const buildBody = () => {
    if (!customerId || !rentalStart || !expectedReturn) return null
    const start = new Date(rentalStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(expectedReturn)
    end.setHours(23, 59, 59, 999)
    return {
      customer_id: customerId,
      rental_start_at: toIsoDateTime(start),
      expected_return_at: toIsoDateTime(end),
      reservation_at: reservationAt ? toIsoDateTime(reservationAt) : null,
      notes: emptyToNull(notes),
      items: items.map((it) => ({
        dress_id: it.dress_id,
        reserved_daily_rental_price: it.reserved_daily_rental_price,
        notes: emptyToNull(it.notes)
      }))
    }
  }

  const handleCreate = async (alsoConfirm: boolean): Promise<void> => {
    const body = buildBody()
    if (!body) return
    const created = await createMutation.mutateAsync(body)
    if (alsoConfirm && canConfirm) {
      await confirmMutation.mutateAsync(created.data.id)
    }
    void navigate(`/reservations/${created.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="حجز جديد" description="معالج إنشاء حجز" />
      <WizardSteps steps={STEPS} current={step} />

      {step === 0 ? (
        <div className="space-y-3">
          <SearchBar value={customerQ} onValueChange={setCustomerQ} placeholder="بحث عن عميل…" />
          {customerId ? (
            <InlineMessage variant="success">المحدد: {customerLabel}</InlineMessage>
          ) : null}
          <ul className="divide-y divide-border rounded-md border border-border">
            {(customers.data?.data ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-start hover:bg-brand-subtle"
                  onClick={() => {
                    setCustomerId(c.id)
                    setCustomerLabel(`${c.full_name} · ${c.customer_number}`)
                  }}
                >
                  {c.full_name} · {c.customer_number}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <SearchBar value={dressQ} onValueChange={setDressQ} placeholder="بحث فستان…" />
          <ul className="max-h-48 divide-y divide-border overflow-auto rounded-md border border-border">
            {(dresses.data?.data ?? []).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-start hover:bg-brand-subtle"
                  disabled={items.some((i) => i.dress_id === d.id)}
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      {
                        dress_id: d.id,
                        name_ar: d.name_ar,
                        reserved_daily_rental_price: d.default_daily_rental_price,
                        notes: ''
                      }
                    ])
                  }
                >
                  {d.name_ar} · {d.barcode} ·{' '}
                  <MoneyDisplay value={d.default_daily_rental_price} />
                </button>
              </li>
            ))}
          </ul>
          <ul className="space-y-3">
            {items.map((it, idx) => (
              <li key={it.dress_id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <span>{it.name_ar}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    إزالة
                  </Button>
                </div>
                <MoneyInput
                  value={it.reserved_daily_rental_price ?? 0}
                  onChange={(v) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, reserved_daily_rental_price: v } : row
                      )
                    )
                  }
                  label="السعر اليومي المتفق"
                />
                <TextInput
                  value={it.notes}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, notes: e.target.value } : row))
                    )
                  }
                  placeholder="ملاحظات البند"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <span className="text-caption text-muted-foreground">بداية الإيجار</span>
            <DatePicker value={rentalStart} onChange={setRentalStart} />
          </div>
          <div className="space-y-1">
            <span className="text-caption text-muted-foreground">الإعادة المتوقعة</span>
            <DatePicker value={expectedReturn} onChange={setExpectedReturn} />
          </div>
          <div className="space-y-1">
            <span className="text-caption text-muted-foreground">وقت الحجز (اختياري)</span>
            <DatePicker value={reservationAt} onChange={setReservationAt} />
          </div>
          <TextInput
            className="w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات"
          />
        </div>
      ) : null}

      {step === 3 ? (
        <AvailabilityPreview
          dressIds={items.map((i) => i.dress_id)}
          startAt={startIso}
          endAt={endIso}
          onAllAvailableChange={setAllAvailable}
        />
      ) : null}

      {step === 4 || step === 5 ? (
        <div className="space-y-3 text-body">
          <p>العميل: {customerLabel}</p>
          <p>
            الفترة:{' '}
            {rentalStart?.toLocaleDateString('ar-IQ')} → {expectedReturn?.toLocaleDateString('ar-IQ')}
          </p>
          <ul>
            {items.map((it) => (
              <li key={it.dress_id}>
                {it.name_ar} —{' '}
                {it.reserved_daily_rental_price != null ? (
                  <MoneyDisplay value={it.reserved_daily_rental_price} />
                ) : (
                  'سعر افتراضي'
                )}
              </li>
            ))}
          </ul>
          {allAvailable === false ? (
            <InlineMessage variant="warning">
              التوفر غير مكتمل — يمكن إنشاء مسودة فقط.
            </InlineMessage>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          السابق
        </Button>
        {step < 5 ? (
          <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            التالي
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => void handleCreate(false)}
            >
              إنشاء مسودة
            </Button>
            {canConfirm ? (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  allAvailable === false || createMutation.isPending || confirmMutation.isPending
                }
                onClick={() => void handleCreate(true)}
              >
                إنشاء وتأكيد
              </Button>
            ) : null}
          </>
        )}
        <Button type="button" variant="ghost" onClick={() => void navigate('/reservations')}>
          إلغاء
        </Button>
      </div>
    </Page>
  )
}
