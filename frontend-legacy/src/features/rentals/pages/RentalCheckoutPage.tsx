import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  InlineMessage,
  Label,
  MoneyDisplay,
  MoneyInput,
  NumberInput,
  Page,
  PageHeader,
  PermissionGuard,
  PhoneInput,
  SearchBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { PhoneService } from '@/lib/phone/phoneService'
import { apiClient } from '@/services/apiClient'
import type { RentalDto } from '@/services/domainTypes'
import { useCreateCustomer } from '@/features/customers/hooks'
import { WizardSteps } from '@/features/reservations/components/WizardSteps'
import { useCheckoutReservation } from '@/features/reservations/hooks'
import { useCheckoutRental, useCreateRental } from '../hooks'

const STEPS = ['العميل', 'الفساتين', 'التواريخ', 'التسعير', 'الدفع', 'التأكيد']

type ItemDraft = {
  dress_id: string
  name_ar: string
  agreed_daily_rental_price: number | null
  notes: string
}

/** Charge basis matching Nest checkout: sum of agreed line prices (not × days). */
function estimateChargeFils(items: ItemDraft[]): number {
  return items.reduce((s, i) => s + (i.agreed_daily_rental_price ?? 0), 0)
}

/** Estimate deposit for Nest checkout body (settlement total = charge − deposit). */
function estimateDepositFils(
  items: ItemDraft[],
  paymentType: 'FIXED_AMOUNT' | 'PERCENTAGE',
  paymentValue: number | null,
  paymentRate: number
): number {
  if (paymentType === 'FIXED_AMOUNT') return Math.max(0, paymentValue ?? 0)
  const charge = estimateChargeFils(items)
  return Math.max(0, Math.round((charge * paymentRate) / 100))
}

export default function RentalCheckoutPage(): React.ReactElement {
  const canCreate = useAnyPermission(['rental.create', 'rentals.create', 'rentals.checkout'])
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
  const [submitting, setSubmitting] = React.useState(false)
  const [quickAddOpen, setQuickAddOpen] = React.useState(false)
  const [quickName, setQuickName] = React.useState('')
  const [quickPhone, setQuickPhone] = React.useState<string>('')
  const [quickError, setQuickError] = React.useState<string | null>(null)

  const createMutation = useCreateRental()
  const checkoutMutation = useCheckoutRental()
  const reservationCheckoutMutation = useCheckoutReservation()
  const createCustomerMutation = useCreateCustomer()

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
    queryKey: [
      'customers',
      'list',
      { q: customerQ, limit: 30, active_only: true, sort_by: 'created_at', sort_dir: 'desc' }
    ],
    queryFn: () =>
      apiClient.customers.list({
        q: customerQ.trim() || undefined,
        limit: 30,
        active_only: true,
        sort_by: 'created_at',
        sort_dir: 'desc'
      }),
    enabled: !fromReservation && step === 0
  })

  const selectCustomer = (id: string, label: string): void => {
    setCustomerId(id)
    setCustomerLabel(label)
  }

  const resetQuickAdd = (): void => {
    setQuickName('')
    setQuickPhone('')
    setQuickError(null)
  }

  const submitQuickAdd = async (): Promise<void> => {
    const name = quickName.trim()
    if (!name) {
      setQuickError('الاسم مطلوب')
      return
    }
    if (!PhoneService.validate(quickPhone)) {
      setQuickError('رقم هاتف عراقي غير صالح')
      return
    }
    const phoneNorm = PhoneService.normalize(quickPhone)
    if (!phoneNorm.ok) {
      setQuickError('رقم هاتف عراقي غير صالح')
      return
    }
    setQuickError(null)
    try {
      const createdCustomer = await createCustomerMutation.mutateAsync({
        full_name: name,
        phone: phoneNorm.e164,
        is_active: true
      })
      const c = createdCustomer.data
      selectCustomer(c.id, `${c.full_name} · ${c.customer_number}`)
      setQuickAddOpen(false)
      resetQuickAdd()
    } catch {
      /* toast handled by mutation */
    }
  }

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

  const previewCharge = estimateChargeFils(items)
  const previewDeposit = estimateDepositFils(
    items,
    paymentType,
    paymentValue,
    paymentRate
  )
  const previewRemaining = Math.max(0, previewCharge - previewDeposit)

  const canNext =
    (step === 0 && Boolean(customerId)) ||
    (step === 1 && (fromReservation || items.length > 0)) ||
    (step === 2 && expectedReturn != null) ||
    step === 3 ||
    (step === 4 &&
      (paymentType === 'FIXED_AMOUNT'
        ? paymentValue != null && paymentValue >= 0
        : paymentRate >= 1 && paymentRate <= 100) &&
      previewDeposit <= previewCharge)

  const enrichFromSettlement = async (rental: RentalDto): Promise<RentalDto> => {
    if (!rental.id) {
      return {
        ...rental,
        estimated_total: estimateChargeFils(items),
        initial_payment_value: estimateDepositFils(
          items,
          paymentType,
          paymentValue,
          paymentRate
        ),
        remaining_balance: Math.max(
          0,
          estimateChargeFils(items) -
            estimateDepositFils(items, paymentType, paymentValue, paymentRate)
        )
      }
    }
    try {
      const stl = await apiClient.settlements.getByRental(rental.id)
      return {
        ...rental,
        estimated_total: stl.data.rental_charge_amount,
        initial_payment_value: stl.data.initial_payment_credit,
        remaining_balance: stl.data.remaining_balance
      }
    } catch {
      return {
        ...rental,
        estimated_total: rental.estimated_total || estimateChargeFils(items),
        initial_payment_value:
          rental.initial_payment_value ||
          estimateDepositFils(items, paymentType, paymentValue, paymentRate),
        remaining_balance:
          rental.remaining_balance ||
          Math.max(
            0,
            (rental.estimated_total || estimateChargeFils(items)) -
              estimateDepositFils(items, paymentType, paymentValue, paymentRate)
          )
      }
    }
  }

  const submit = async (): Promise<void> => {
    if (!customerId || !expectedReturn) return
    const end = new Date(expectedReturn)
    end.setHours(23, 59, 59, 999)
    const depositAmountFils = estimateDepositFils(
      items,
      paymentType,
      paymentValue,
      paymentRate
    )
    setSubmitting(true)
    try {
      if (fromReservation && reservationId) {
        const res = await reservationCheckoutMutation.mutateAsync({
          id: reservationId,
          body: { depositAmountFils }
        })
        const rentalId = res.data.rental_id
        if (rentalId) {
          const rental = await apiClient.rentals.get(rentalId)
          setCreated(await enrichFromSettlement(rental.data))
        } else {
          setCreated(
            await enrichFromSettlement({
              id: '',
              rental_number: res.data.reservation_number,
              customer_id: res.data.customer_id,
              reservation_id: res.data.id,
              rental_at: new Date().toISOString(),
              expected_return_at: res.data.expected_return_at,
              status: 'CHECKED_OUT',
              initial_payment_type: paymentType,
              initial_payment_rate: paymentType === 'PERCENTAGE' ? paymentRate : null,
              initial_payment_value: depositAmountFils,
              estimated_total: estimateChargeFils(items),
              remaining_balance: Math.max(
                0,
                estimateChargeFils(items) - depositAmountFils
              ),
              notes: res.data.notes,
              items: [],
              created_at: res.data.created_at,
              updated_at: res.data.updated_at
            })
          )
        }
        setStep(5)
        return
      }

      const body = {
        customer_id: customerId,
        expected_return_at: end.toISOString(),
        initial_payment_type: paymentType,
        rental_at: rentalAt ? rentalAt.toISOString() : null,
        reservation_id: null,
        initial_payment_value: paymentType === 'FIXED_AMOUNT' ? paymentValue : null,
        initial_payment_rate: paymentType === 'PERCENTAGE' ? paymentRate : null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          dress_id: it.dress_id,
          agreed_daily_rental_price: it.agreed_daily_rental_price,
          notes: it.notes.trim() || null
        }))
      }
      const draft = await createMutation.mutateAsync(body)
      const active = await checkoutMutation.mutateAsync({
        id: draft.data.id,
        body: { depositAmountFils }
      })
      setCreated(await enrichFromSettlement(active.data))
      setStep(5)
    } finally {
      setSubmitting(false)
    }
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
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <SearchBar
                  value={customerQ}
                  onValueChange={setCustomerQ}
                  placeholder="بحث بالاسم أو الهاتف أو الرقم…"
                />
              </div>
              <PermissionGuard permission="customer.create">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetQuickAdd()
                    setQuickAddOpen(true)
                  }}
                >
                  إضافة سريعة
                </Button>
              </PermissionGuard>
            </div>
            {customerId ? (
              <InlineMessage variant="success">المحدد: {customerLabel}</InlineMessage>
            ) : (
              <InlineMessage variant="info">
                اختر عميلاً من القائمة أو أضف عميلاً جديداً بسرعة
              </InlineMessage>
            )}
            {customers.isLoading ? (
              <BusyIndicator label="جاري تحميل العملاء…" />
            ) : (customers.data?.data.length ?? 0) === 0 ? (
              <InlineMessage variant="warning">
                لا يوجد عملاء مطابقون — جرّب البحث أو الإضافة السريعة
              </InlineMessage>
            ) : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {(customers.data?.data ?? []).map((c) => {
                  const selected = c.id === customerId
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={
                          selected
                            ? 'w-full bg-brand-subtle px-3 py-2 text-start'
                            : 'w-full px-3 py-2 text-start hover:bg-brand-subtle'
                        }
                        onClick={() =>
                          selectCustomer(c.id, `${c.full_name} · ${c.customer_number}`)
                        }
                      >
                        <span className="block font-medium">{c.full_name}</span>
                        <span className="block text-caption text-muted-foreground" dir="ltr">
                          {c.customer_number} · {c.phone}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <Dialog
              open={quickAddOpen}
              onOpenChange={(open) => {
                setQuickAddOpen(open)
                if (!open) resetQuickAdd()
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة سريعة لعميل</DialogTitle>
                  <DialogDescription>
                    أدخل الاسم والهاتف — سيتم اختيار العميل تلقائياً بعد الحفظ
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="quick-customer-name">الاسم *</Label>
                    <TextInput
                      id="quick-customer-name"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      placeholder="اسم العميل"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quick-customer-phone">الهاتف *</Label>
                    <PhoneInput
                      id="quick-customer-phone"
                      value={quickPhone || null}
                      onChange={(v) => setQuickPhone(v ?? '')}
                      placeholder="07xxxxxxxxx"
                    />
                  </div>
                  {quickError ? (
                    <InlineMessage variant="danger">{quickError}</InlineMessage>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setQuickAddOpen(false)}
                    disabled={createCustomerMutation.isPending}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void submitQuickAdd()}
                    disabled={createCustomerMutation.isPending}
                  >
                    {createCustomerMutation.isPending ? 'جاري الحفظ…' : 'حفظ واختيار'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
              {(dresses.data?.data ?? []).map((d) => {
                const hasBarcode = Boolean(d.barcode?.trim())
                const already = items.some((i) => i.dress_id === d.id)
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-start hover:bg-brand-subtle disabled:opacity-50"
                      disabled={already || !hasBarcode}
                      title={
                        !hasBarcode
                          ? 'الفستان بلا باركود مفعّل — أضف باركوداً من المخزون أولاً'
                          : undefined
                      }
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
                      {d.name_ar} · {hasBarcode ? d.barcode : 'بدون باركود'}
                    </button>
                  </li>
                )
              })}
            </ul>
            {(dresses.data?.data ?? []).some((d) => !d.barcode?.trim()) ? (
              <InlineMessage variant="warning">
                بعض الفساتين بلا باركود مفعّل — افتح المخزون وأضف باركوداً قبل التأجير.
              </InlineMessage>
            ) : null}
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
            الإيجار المتفق يُحسب كرسوم التأجير عند التسليم. الدفعة الأولية تُخصم منها في التسوية.
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
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted-foreground">رسوم التأجير</dt>
              <dd>
                <MoneyDisplay value={previewCharge} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">الإعادة المتوقعة</dt>
              <dd>{expectedReturn?.toLocaleDateString('ar-IQ') ?? '—'}</dd>
            </div>
          </dl>
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
          <dl className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-muted-foreground">رسوم التأجير</dt>
              <dd>
                <MoneyDisplay value={previewCharge} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">الدفعة الأولية</dt>
              <dd>
                <MoneyDisplay value={previewDeposit} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">المتبقي</dt>
              <dd>
                <MoneyDisplay value={previewRemaining} />
              </dd>
            </div>
          </dl>
          {previewDeposit > previewCharge ? (
            <InlineMessage variant="danger">
              الدفعة الأولية أكبر من رسوم التأجير — الخادم سيرفض التسليم.
            </InlineMessage>
          ) : null}
        </div>
      ) : null}

      {step === 5 && created ? (
        <div className="space-y-3">
          <InlineMessage variant="success">
            تم الإنشاء: {created.rental_number}
          </InlineMessage>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-muted-foreground">رسوم التأجير</dt>
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
          <Button
            type="button"
            onClick={() => {
              if (created.id) void navigate(`/rentals/${created.id}`)
              else void navigate('/rentals')
            }}
          >
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
              disabled={
                !canNext ||
                submitting ||
                createMutation.isPending ||
                checkoutMutation.isPending ||
                reservationCheckoutMutation.isPending
              }
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
