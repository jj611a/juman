import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  InlineMessage,
  MoneyDisplay,
  MoneyInput,
  NumberInput,
  Page,
  PageHeader,
  SearchBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { RentalDto } from '@/services/domainTypes'
import { WizardSteps } from '@/features/reservations/components/WizardSteps'
import { useCreateRental } from '../hooks'

const STEPS = ['العميل', 'الفساتين', 'التواريخ', 'التسعير', 'الدفع', 'التأكيد']

type ItemDraft = {
  dress_id: string
  name_ar: string
  agreed_daily_rental_price: number | null
  notes: string
}

export default function RentalCheckoutPage(): React.ReactElement {
  const canCreate = usePermission('rental.create')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reservationId = params.get('reservationId')
  const fromReservation = Boolean(reservationId)

  const [step, setStep] = React.useState(0)
  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [customerLabel, setCustomerLabel] = React.useState('')
  const [dressQ, setDressQ] = React.useState('')
  const [items, setItems] = React.useState<ItemDraft[]>([])
  const [expectedReturn, setExpectedReturn] = React.useState<Date | null>(null)
  const [rentalAt, setRentalAt] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState('')
  const [paymentType, setPaymentType] = React.useState<'FIXED_AMOUNT' | 'PERCENTAGE'>(
    'FIXED_AMOUNT'
  )
  const [paymentValue, setPaymentValue] = React.useState<number | null>(0)
  const [paymentRate, setPaymentRate] = React.useState<number>(30)
  const [created, setCreated] = React.useState<RentalDto | null>(null)

  const createMutation = useCreateRental()

  const reservationQuery = useQuery({
    queryKey: ['reservations', 'detail', reservationId],
    queryFn: () => apiClient.reservations.get(reservationId!),
    enabled: Boolean(reservationId)
  })

  React.useEffect(() => {
    const res = reservationQuery.data?.data
    if (!res) return
    setCustomerId(res.customer_id)
    setExpectedReturn(new Date(res.expected_return_at))
    setItems(
      res.items.map((it) => ({
        dress_id: it.dress_id,
        name_ar: it.dress_id.slice(0, 8),
        agreed_daily_rental_price: it.reserved_daily_rental_price,
        notes: it.notes ?? ''
      }))
    )
    void apiClient.customers.get(res.customer_id).then((c) => {
      setCustomerLabel(`${c.data.full_name} · ${c.data.customer_number}`)
    })
  }, [reservationQuery.data])

  const customers = useQuery({
    queryKey: ['customers', 'list', { q: customerQ, limit: 20 }],
    queryFn: () => apiClient.customers.list({ q: customerQ || undefined, limit: 20 }),
    enabled: !fromReservation && step === 0 && customerQ.trim().length >= 1
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
    enabled: !fromReservation && step === 1
  })

  if (!canCreate) return <Navigate to="/forbidden" replace />

  if (fromReservation && reservationQuery.isLoading) {
    return (
      <Page size="md" as="main">
        <BusyIndicator label="جاري تحميل الحجز…" />
      </Page>
    )
  }

  if (fromReservation && reservationQuery.isError) {
    return <Navigate to="/reservations" replace />
  }

  if (
    fromReservation &&
    reservationQuery.data &&
    reservationQuery.data.data.status !== 'CONFIRMED'
  ) {
    return <Navigate to={`/reservations/${reservationId}`} replace />
  }

  const canNext =
    (step === 0 && Boolean(customerId)) ||
    (step === 1 && (fromReservation || items.length > 0)) ||
    (step === 2 && expectedReturn != null) ||
    step === 3 ||
    (step === 4 &&
      (paymentType === 'FIXED_AMOUNT'
        ? paymentValue != null && paymentValue >= 0
        : paymentRate >= 1 && paymentRate <= 100))

  const submit = async (): Promise<void> => {
    if (!customerId || !expectedReturn) return
    const end = new Date(expectedReturn)
    end.setHours(23, 59, 59, 999)
    const body = {
      customer_id: customerId,
      expected_return_at: end.toISOString(),
      initial_payment_type: paymentType,
      rental_at: rentalAt && !fromReservation ? rentalAt.toISOString() : null,
      reservation_id: reservationId,
      initial_payment_value: paymentType === 'FIXED_AMOUNT' ? paymentValue : null,
      initial_payment_rate: paymentType === 'PERCENTAGE' ? paymentRate : null,
      notes: notes.trim() || null,
      items: fromReservation
        ? null
        : items.map((it) => ({
            dress_id: it.dress_id,
            agreed_daily_rental_price: it.agreed_daily_rental_price,
            notes: it.notes.trim() || null
          }))
    }
    const res = await createMutation.mutateAsync(body)
    setCreated(res.data)
    setStep(5)
  }

  return (
    <Page size="md" as="main">
      <PageHeader
        title={fromReservation ? 'تحويل حجز لتأجير' : 'تأجير جديد'}
        description="تسليم فوري مع دفعة أولية"
      />
      <WizardSteps steps={STEPS} current={step} />

      {step === 0 ? (
        fromReservation ? (
          <InlineMessage variant="info">العميل من الحجز: {customerLabel || '…'}</InlineMessage>
        ) : (
          <div className="space-y-3">
            <SearchBar value={customerQ} onValueChange={setCustomerQ} placeholder="بحث عميل…" />
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
                    {c.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}

      {step === 1 ? (
        fromReservation ? (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.dress_id} className="rounded-md border border-border p-3">
                <span dir="ltr">{it.dress_id.slice(0, 8)}…</span>
                {it.agreed_daily_rental_price != null ? (
                  <>
                    {' '}
                    — <MoneyDisplay value={it.agreed_daily_rental_price} />
                  </>
                ) : null}
              </li>
            ))}
            <InlineMessage variant="info">البنود من الحجز — لا يمكن تعديلها هنا.</InlineMessage>
          </ul>
        ) : (
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
                          agreed_daily_rental_price: d.default_daily_rental_price,
                          notes: ''
                        }
                      ])
                    }
                  >
                    {d.name_ar} · {d.barcode}
                  </button>
                </li>
              ))}
            </ul>
            {items.map((it, idx) => (
              <div key={it.dress_id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex justify-between">
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
                  value={it.agreed_daily_rental_price}
                  onChange={(v) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, agreed_daily_rental_price: v } : row
                      )
                    )
                  }
                  label="السعر اليومي المتفق"
                />
              </div>
            ))}
          </div>
        )
      ) : null}

      {step === 2 ? (
        <div className="flex flex-wrap gap-4">
          {!fromReservation ? (
            <div className="space-y-1">
              <span className="text-caption text-muted-foreground">وقت التسليم (اختياري)</span>
              <DatePicker value={rentalAt} onChange={setRentalAt} />
            </div>
          ) : (
            <InlineMessage variant="info">
              وقت التسليم يُضبط من الخادم عند التحويل من حجز.
            </InlineMessage>
          )}
          <div className="space-y-1">
            <span className="text-caption text-muted-foreground">الإعادة المتوقعة</span>
            <DatePicker
              value={expectedReturn}
              onChange={setExpectedReturn}
              disabled={fromReservation}
            />
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
        <div className="space-y-3">
          <InlineMessage variant="info">
            عرض أسعار يومية فقط — الإجمالي التقديري والمتبقي يأتيان من الخادم بعد الإنشاء.
          </InlineMessage>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.dress_id} className="flex justify-between gap-2 border-b border-border py-2">
                <span>{it.name_ar || it.dress_id.slice(0, 8)}</span>
                {it.agreed_daily_rental_price != null ? (
                  <MoneyDisplay value={it.agreed_daily_rental_price} />
                ) : (
                  <span>—</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">
            الفترة حتى: {expectedReturn?.toLocaleDateString('ar-IQ') ?? '—'}
          </p>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <Select
            value={paymentType}
            onValueChange={(v) => setPaymentType(v as 'FIXED_AMOUNT' | 'PERCENTAGE')}
          >
            <SelectTrigger>
              <SelectValue placeholder="نوع الدفعة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED_AMOUNT">مبلغ ثابت</SelectItem>
              <SelectItem value="PERCENTAGE">نسبة مئوية</SelectItem>
            </SelectContent>
          </Select>
          {paymentType === 'FIXED_AMOUNT' ? (
            <MoneyInput
              value={paymentValue}
              onChange={setPaymentValue}
              label="مبلغ الدفعة الأولية"
            />
          ) : (
            <NumberInput
              value={paymentRate}
              onChange={(e) => setPaymentRate(Number(e.target.value) || 0)}
              label="النسبة %"
              min={1}
              max={100}
            />
          )}
        </div>
      ) : null}

      {step === 5 && created ? (
        <div className="space-y-3">
          <InlineMessage variant="success">
            تم الإنشاء: {created.rental_number}
          </InlineMessage>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-muted-foreground">الإجمالي التقديري</dt>
              <dd>
                <MoneyDisplay value={created.estimated_total} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">الدفعة الأولية</dt>
              <dd>
                <MoneyDisplay value={created.initial_payment_value} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">المتبقي</dt>
              <dd>
                <MoneyDisplay value={created.remaining_balance} />
              </dd>
            </div>
          </dl>
          <Button type="button" onClick={() => void navigate(`/rentals/${created.id}`)}>
            فتح التفاصيل
          </Button>
        </div>
      ) : null}

      {step < 5 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || (fromReservation && step <= 1)}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            السابق
          </Button>
          {step < 4 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              التالي
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canNext || createMutation.isPending}
              onClick={() => void submit()}
            >
              تأكيد التسليم
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => void navigate('/rentals')}>
            إلغاء
          </Button>
        </div>
      ) : null}
    </Page>
  )
}
