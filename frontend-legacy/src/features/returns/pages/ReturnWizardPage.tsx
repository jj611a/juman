import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  InlineMessage,
  MoneyDisplay,
  Page,
  PageHeader,
  SearchBar,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { WizardSteps } from '@/features/reservations/components/WizardSteps'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { RentalDto } from '@/services/domainTypes'
import { useCreateReturn } from '../hooks'

const STEPS = ['اختيار التأجير', 'مراجعة', 'التأكيد']

export default function ReturnWizardPage(): React.ReactElement {
  const canCreate = usePermission('return.create')
  const navigate = useNavigate()
  const createMutation = useCreateReturn()

  const [step, setStep] = React.useState(0)
  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | undefined>()
  const [selectedRentalId, setSelectedRentalId] = React.useState<string | null>(null)
  const [listOffset, setListOffset] = React.useState(0)
  const [notes, setNotes] = React.useState('')
  const [returnedAt, setReturnedAt] = React.useState<Date | null>(null)

  const listLimit = 20

  const customers = useQuery({
    queryKey: ['customers', 'list', { q: customerQ, limit: 20 }],
    queryFn: () => apiClient.customers.list({ q: customerQ || undefined, limit: 20 }),
    enabled: customerQ.trim().length >= 2 || Boolean(customerId)
  })

  const rentalsList = useQuery({
    queryKey: ['rentals', 'list', 'ACTIVE', { customerId, offset: listOffset, limit: listLimit }],
    queryFn: () =>
      apiClient.rentals.list({
        status: 'ACTIVE',
        customer_id: customerId,
        offset: listOffset,
        limit: listLimit
      }),
    enabled: step === 0
  })

  const rentalDetail = useQuery({
    queryKey: ['rentals', 'detail', selectedRentalId],
    queryFn: () => apiClient.rentals.get(selectedRentalId!),
    enabled: Boolean(selectedRentalId)
  })

  const rental: RentalDto | undefined = rentalDetail.data?.data

  const customerDetail = useQuery({
    queryKey: ['customers', 'detail', rental?.customer_id],
    queryFn: () => apiClient.customers.get(rental!.customer_id),
    enabled: Boolean(rental?.customer_id)
  })

  const customerNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers.data?.data ?? []) map.set(c.id, c.full_name)
    return map
  }, [customers.data])

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const listTotal = rentalsList.data?.meta.total ?? 0
  const listPageCount = Math.max(1, Math.ceil(listTotal / listLimit) || 1)
  const listPageIndex = Math.floor(listOffset / listLimit)

  const canNext =
    (step === 0 && Boolean(selectedRentalId) && rentalDetail.isSuccess) ||
    (step === 1 && Boolean(rental))

  const submit = async (): Promise<void> => {
    if (!selectedRentalId || !rental) return
    const res = await createMutation.mutateAsync({
      rental_id: selectedRentalId,
      customer_id: rental.customer_id,
      notes: notes.trim() || null,
      returned_at: returnedAt ? returnedAt.toISOString() : null
    })
    void navigate(`/returns/${res.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="مرتجع جديد" description="تسجيل استلام فساتين من تأجير نشط" />
      <WizardSteps steps={STEPS} current={step} />

      <InlineMessage variant="info">
        الفحص والتسوية المالية يتمّان في وحدات منفصلة بعد تسجيل المرتجع.
      </InlineMessage>

      {step === 0 ? (
        <div className="mt-4 space-y-3">
          <SearchBar
            value={customerQ}
            onValueChange={(v) => {
              setCustomerQ(v)
              setCustomerId(undefined)
              setListOffset(0)
              setSelectedRentalId(null)
            }}
            placeholder="بحث عميل ثم اختيار…"
          />
          {!customerId && customerQ.trim().length >= 2 && (customers.data?.data.length ?? 0) > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-md border border-border">
              {(customers.data?.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-start hover:bg-brand-subtle"
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerQ(c.full_name)
                      setListOffset(0)
                      setSelectedRentalId(null)
                    }}
                  >
                    {c.full_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {rentalsList.isLoading ? (
            <BusyIndicator label="جاري تحميل التأجيرات النشطة…" />
          ) : rentalsList.isError ? (
            <InlineMessage variant="warning">تعذر تحميل التأجيرات النشطة</InlineMessage>
          ) : (rentalsList.data?.data.length ?? 0) === 0 ? (
            <InlineMessage variant="info">لا تأجيرات نشطة مطابقة للبحث</InlineMessage>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-md border border-border">
                {(rentalsList.data?.data ?? []).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-3 text-start hover:bg-brand-subtle ${
                        selectedRentalId === row.id ? 'bg-brand-subtle ring-1 ring-brand' : ''
                      }`}
                      onClick={() => setSelectedRentalId(row.id)}
                    >
                      <p className="font-medium">{row.rental_number}</p>
                      <p className="text-caption text-muted-foreground">
                        {customerNameById.get(row.customer_id) ?? row.customer_id.slice(0, 8)} ·{' '}
                        {new Date(row.rental_at).toLocaleDateString('ar-IQ')} —{' '}
                        {new Date(row.expected_return_at).toLocaleDateString('ar-IQ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {listPageCount > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={listPageIndex <= 0}
                    onClick={() => setListOffset((o) => Math.max(0, o - listLimit))}
                  >
                    السابق
                  </Button>
                  <span className="text-caption text-muted-foreground">
                    {listPageIndex + 1} / {listPageCount}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={listPageIndex >= listPageCount - 1}
                    onClick={() => setListOffset((o) => o + listLimit)}
                  >
                    التالي
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {selectedRentalId && rentalDetail.isLoading ? (
            <BusyIndicator label="جاري تحميل تفاصيل التأجير…" />
          ) : null}
          {selectedRentalId && rentalDetail.isError ? (
            <InlineMessage variant="warning">تعذر تحميل تفاصيل التأجير</InlineMessage>
          ) : null}
          {rental ? (
            <InlineMessage variant="success">المحدد: {rental.rental_number}</InlineMessage>
          ) : null}
        </div>
      ) : null}

      {step === 1 && rental ? (
        <div className="mt-4 space-y-6">
          <div>
            <p className="text-caption text-muted-foreground">العميل</p>
            <p>{customerDetail.data?.data.full_name ?? rental.customer_id}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-caption text-muted-foreground">التسليم</p>
              <p>{new Date(rental.rental_at).toLocaleString('ar-IQ')}</p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">الإعادة المتوقعة</p>
              <p>{new Date(rental.expected_return_at).toLocaleString('ar-IQ')}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">الإجمالي التقديري</p>
              <MoneyDisplay value={rental.estimated_total} />
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">الدفعة الأولية</p>
              <MoneyDisplay value={rental.initial_payment_value} />
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">المتبقي</p>
              <MoneyDisplay value={rental.remaining_balance} />
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-title text-foreground">البنود</h3>
            {(rental.items?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">لا بنود</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {rental.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                    <div>
                      <p dir="ltr" className="text-caption text-muted-foreground">
                        {item.dress_id}
                      </p>
                      <p className="text-caption">
                        أيام متوقعة (من الخادم): {item.expected_rental_days}
                      </p>
                    </div>
                    <MoneyDisplay value={item.agreed_daily_rental_price} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-4">
            <div className="min-w-[200px] flex-1 space-y-1">
              <span className="text-caption text-muted-foreground">وقت الإرجاع (اختياري)</span>
              <DatePicker value={returnedAt} onChange={setReturnedAt} />
            </div>
            <TextInput
              className="w-full flex-[2]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
            />
          </div>
        </div>
      ) : null}

      {step === 2 && rental ? (
        <div className="mt-4 space-y-4">
          <p className="text-title text-foreground">تأكيد تسجيل المرتجع</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-caption text-muted-foreground">التأجير</dt>
              <dd>{rental.rental_number}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">العميل</dt>
              <dd>{customerDetail.data?.data.full_name ?? rental.customer_id}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">عدد البنود</dt>
              <dd>{rental.items?.length ?? 0}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">وقت الإرجاع</dt>
              <dd>
                {returnedAt ? returnedAt.toLocaleString('ar-IQ') : 'الوقت الحالي (من الخادم)'}
              </dd>
            </div>
            {notes.trim() ? (
              <div className="sm:col-span-2">
                <dt className="text-caption text-muted-foreground">ملاحظات</dt>
                <dd>{notes.trim()}</dd>
              </div>
            ) : null}
          </dl>
          <InlineMessage variant="info">
            بعد التسجيل ستنتقل الحالة إلى «بانتظار الفحص» — ابدأ الفحص من صفحة المرتجع.
          </InlineMessage>
        </div>
      ) : null}

      {step < 3 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            السابق
          </Button>
          {step < 2 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              التالي
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canNext || createMutation.isPending}
              onClick={() => void submit()}
            >
              تسجيل المرتجع
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => void navigate('/returns')}>
            إلغاء
          </Button>
        </div>
      ) : null}
    </Page>
  )
}
