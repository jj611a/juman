import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  InlineMessage,
  MoneyDisplay,
  MoneyInput,
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
import { useInspectionsList } from '@/features/processing/hooks'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { SaleCreateBody, SaleOrigin, SalePaymentMethod } from '@/services/domainTypes'
import { useCreateSale } from '../hooks'

type NormalItemDraft = {
  dress_id: string
  name_ar: string
  default_sale_price: number | null
  actual_sale_price: number | null
  notes: string
}

type MandatoryCandidate = {
  inspection_item_id: string
  inspection_id: string
  inspection_number: string
  dress_id: string
  return_id: string
}

const PAYMENT_METHODS: SalePaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']

const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  CASH: 'نقد',
  CARD: 'بطاقة',
  BANK_TRANSFER: 'تحويل بنكي',
  OTHER: 'أخرى'
}

export default function SaleCreatePage(): React.ReactElement {
  const canCreate = usePermission('sale.create')
  const navigate = useNavigate()
  const createMutation = useCreateSale()

  const [origin, setOrigin] = React.useState<SaleOrigin>('NORMAL_SALE')

  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [customerLabel, setCustomerLabel] = React.useState('')

  const [dressQ, setDressQ] = React.useState('')
  const [normalItems, setNormalItems] = React.useState<NormalItemDraft[]>([])

  const [inspectionItemId, setInspectionItemId] = React.useState('')
  const [mandatoryDressId, setMandatoryDressId] = React.useState<string | null>(null)
  const [mandatoryActualPrice, setMandatoryActualPrice] = React.useState<number | null>(null)

  const [paymentMethod, setPaymentMethod] = React.useState<SalePaymentMethod>('CASH')
  const [paymentAmount, setPaymentAmount] = React.useState<number | null>(null)
  const [notes, setNotes] = React.useState('')

  const customers = useQuery({
    queryKey: ['customers', 'list', { q: customerQ, limit: 20 }],
    queryFn: () => apiClient.customers.list({ q: customerQ || undefined, limit: 20 }),
    enabled: customerQ.trim().length >= 1
  })

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { q: dressQ, page: 1, page_size: 20, status: 'AVAILABLE' }],
    queryFn: () =>
      apiClient.dresses.list({
        q: dressQ || undefined,
        page: 1,
        page_size: 20,
        status: 'AVAILABLE',
        is_active: true
      }),
    enabled: origin === 'NORMAL_SALE'
  })

  const completedInspections = useInspectionsList({
    status: 'COMPLETED',
    offset: 0,
    limit: 50,
    sort_by: 'created_at',
    sort_dir: 'desc'
  })

  const mandatoryCandidates = React.useMemo((): MandatoryCandidate[] => {
    const rows: MandatoryCandidate[] = []
    for (const inspection of completedInspections.data?.data ?? []) {
      for (const item of inspection.items ?? []) {
        if (item.condition === 'MAJOR_DAMAGE' && item.send_to_ruined) {
          rows.push({
            inspection_item_id: item.id,
            inspection_id: inspection.id,
            inspection_number: inspection.inspection_number,
            dress_id: item.dress_id,
            return_id: inspection.return_id
          })
        }
      }
    }
    return rows
  }, [completedInspections.data])

  const resolveMandatoryCustomer = React.useCallback(async (returnId: string): Promise<void> => {
    const ret = await apiClient.returns.get(returnId)
    const customer = await apiClient.customers.get(ret.data.customer_id)
    setCustomerId(ret.data.customer_id)
    setCustomerLabel(`${customer.data.full_name} · ${customer.data.customer_number}`)
    setCustomerQ(customer.data.full_name)
  }, [])

  const handlePickMandatoryCandidate = (candidate: MandatoryCandidate): void => {
    setInspectionItemId(candidate.inspection_item_id)
    setMandatoryDressId(candidate.dress_id)
    setMandatoryActualPrice(null)
    void resolveMandatoryCustomer(candidate.return_id)
  }

  const handleInspectionItemIdBlur = async (): Promise<void> => {
    const trimmed = inspectionItemId.trim()
    if (!trimmed) {
      setMandatoryDressId(null)
      return
    }
    try {
      const inspections = completedInspections.data?.data ?? []
      for (const inspection of inspections) {
        const match = inspection.items?.find((item) => item.id === trimmed)
        if (match && match.condition === 'MAJOR_DAMAGE' && match.send_to_ruined) {
          setMandatoryDressId(match.dress_id)
          await resolveMandatoryCustomer(inspection.return_id)
          return
        }
      }
      setMandatoryDressId(null)
    } catch {
      setMandatoryDressId(null)
    }
  }

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const canSubmitNormal =
    normalItems.length > 0 && paymentAmount != null && paymentAmount > 0

  const canSubmitMandatory =
    Boolean(inspectionItemId.trim()) &&
    Boolean(mandatoryDressId) &&
    Boolean(customerId) &&
    paymentAmount != null &&
    paymentAmount > 0

  const submit = async (): Promise<void> => {
    let body: SaleCreateBody

    if (origin === 'NORMAL_SALE') {
      body = {
        origin: 'NORMAL_SALE',
        customer_id: customerId,
        items: normalItems.map((item) => ({
          dress_id: item.dress_id,
          actual_sale_price: item.actual_sale_price,
          notes: item.notes.trim() || null
        })),
        payment: {
          amount: paymentAmount!,
          payment_method: paymentMethod
        },
        notes: notes.trim() || null
      }
    } else {
      body = {
        origin: 'MANDATORY_DAMAGE_PURCHASE',
        customer_id: customerId,
        inspection_item_id: inspectionItemId.trim(),
        items: [
          {
            dress_id: mandatoryDressId!,
            actual_sale_price: mandatoryActualPrice,
            notes: null
          }
        ],
        payment: {
          amount: paymentAmount!,
          payment_method: paymentMethod
        },
        notes: notes.trim() || null
      }
    }

    const res = await createMutation.mutateAsync(body)
    void navigate(`/sales/${res.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="بيع جديد" description="إنشاء فاتورة بيع مكتملة مع الدفع" />

      <div className="space-y-6">
        <div className="space-y-2">
          <span className="text-caption text-muted-foreground">نوع البيع</span>
          <Select
            value={origin}
            onValueChange={(v) => {
              setOrigin(v as SaleOrigin)
              setNormalItems([])
              setInspectionItemId('')
              setMandatoryDressId(null)
              setMandatoryActualPrice(null)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="نوع البيع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NORMAL_SALE">بيع عادي</SelectItem>
              <SelectItem value="MANDATORY_DAMAGE_PURCHASE">شراء ضرر إلزامي</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <span className="text-caption text-muted-foreground">
            {origin === 'MANDATORY_DAMAGE_PURCHASE' ? 'العميل (مطلوب)' : 'العميل (اختياري)'}
          </span>
          <SearchBar value={customerQ} onValueChange={setCustomerQ} placeholder="بحث عميل…" />
          {customerId ? (
            <InlineMessage variant="success">المحدد: {customerLabel}</InlineMessage>
          ) : null}
          {!customerId ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(customers.data?.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-start hover:bg-brand-subtle"
                    onClick={() => {
                      setCustomerId(c.id)
                      setCustomerLabel(`${c.full_name} · ${c.customer_number}`)
                      setCustomerQ(c.full_name)
                    }}
                  >
                    {c.full_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomerId(null)
                setCustomerLabel('')
                setCustomerQ('')
              }}
            >
              إزالة العميل
            </Button>
          )}
        </div>

        {origin === 'NORMAL_SALE' ? (
          <div className="space-y-4">
            <InlineMessage variant="info">
              اختر فساتين بحالة «متاح» فقط. السعر الافتراضي يأتي من المخزون — يمكن تعديل سعر البيع
              إذا كان مسموحاً في الإعدادات.
            </InlineMessage>
            <SearchBar value={dressQ} onValueChange={setDressQ} placeholder="بحث فستان…" />
            <ul className="divide-y divide-border rounded-md border border-border">
              {(dresses.data?.data ?? []).map((dress) => {
                const selected = normalItems.some((item) => item.dress_id === dress.id)
                return (
                  <li
                    key={dress.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{dress.name_ar}</p>
                      <p className="text-caption text-muted-foreground" dir="ltr">
                        {dress.barcode}
                      </p>
                      <MoneyDisplay value={dress.default_sale_price} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      disabled={selected}
                      onClick={() =>
                        setNormalItems((prev) => [
                          ...prev,
                          {
                            dress_id: dress.id,
                            name_ar: dress.name_ar,
                            default_sale_price: dress.default_sale_price,
                            actual_sale_price: null,
                            notes: ''
                          }
                        ])
                      }
                    >
                      {selected ? 'مضاف' : 'إضافة'}
                    </Button>
                  </li>
                )
              })}
            </ul>

            {normalItems.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-title text-foreground">الفساتين المختارة</h3>
                {normalItems.map((item, idx) => (
                  <div key={item.dress_id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{item.name_ar}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setNormalItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        إزالة
                      </Button>
                    </div>
                    <MoneyInput
                      value={item.actual_sale_price}
                      onChange={(v) =>
                        setNormalItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, actual_sale_price: v } : row
                          )
                        )
                      }
                      label="سعر البيع (اختياري — الافتراضي من المخزون)"
                    />
                    <TextInput
                      value={item.notes}
                      onChange={(e) =>
                        setNormalItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, notes: e.target.value } : row
                          )
                        )
                      }
                      placeholder="ملاحظات البند"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <InlineMessage variant="info">
              اختر عنصر فحص مكتمل بحالة ضرر جسيم مع إرسال إلى التالف، أو أدخل معرّف عنصر الفحص
              يدوياً.
            </InlineMessage>
            <TextInput
              value={inspectionItemId}
              onChange={(e) => setInspectionItemId(e.target.value)}
              onBlur={() => void handleInspectionItemIdBlur()}
              placeholder="معرّف عنصر الفحص"
              dir="ltr"
            />
            {mandatoryDressId ? (
              <InlineMessage variant="success">
                الفستان المرتبط: <span dir="ltr">{mandatoryDressId}</span>
              </InlineMessage>
            ) : null}

            {completedInspections.isLoading ? (
              <BusyIndicator label="جاري تحميل الفحوصات…" />
            ) : mandatoryCandidates.length === 0 ? (
              <InlineMessage variant="warning">لا عناصر فحص مؤهلة للبيع الإلزامي</InlineMessage>
            ) : (
              <ul className="max-h-60 divide-y divide-border overflow-auto rounded-md border border-border">
                {mandatoryCandidates.map((candidate) => (
                  <li
                    key={candidate.inspection_item_id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{candidate.inspection_number}</p>
                      <p className="text-caption text-muted-foreground" dir="ltr">
                        {candidate.dress_id.slice(0, 8)}…
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        inspectionItemId === candidate.inspection_item_id ? 'secondary' : 'outline'
                      }
                      onClick={() => handlePickMandatoryCandidate(candidate)}
                    >
                      اختيار
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <MoneyInput
              value={mandatoryActualPrice}
              onChange={setMandatoryActualPrice}
              label="سعر البيع (اختياري — الافتراضي من المخزون)"
            />
          </div>
        )}

        <div className="space-y-4 rounded-md border border-border p-4">
          <h3 className="text-title text-foreground">الدفع</h3>
          <Select
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as SalePaymentMethod)}
          >
            <SelectTrigger>
              <SelectValue placeholder="طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MoneyInput value={paymentAmount} onChange={setPaymentAmount} label="مبلغ الدفع" />
        </div>

        <TextInput
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات الفاتورة"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              createMutation.isPending ||
              (origin === 'NORMAL_SALE' ? !canSubmitNormal : !canSubmitMandatory)
            }
            onClick={() => void submit()}
          >
            {createMutation.isPending ? 'جاري الإنشاء…' : 'تأكيد البيع'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void navigate('/sales')}>
            إلغاء
          </Button>
        </div>
      </div>
    </Page>
  )
}
