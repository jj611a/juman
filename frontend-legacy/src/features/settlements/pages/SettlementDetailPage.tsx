import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AuditTimeline,
  Button,
  EmptyState,
  EntityHeader,
  ErrorState,
  InlineMessage,
  MoneyDisplay,
  MoneyInput,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { toAppError } from '@/lib/errors/appError'
import { apiClient } from '@/services/apiClient'
import type { SettlementPaymentMethod } from '@/services/domainTypes'
import {
  useAdjustSettlement,
  useCancelSettlement,
  useCloseSettlement,
  useCollectSettlementPayment,
  useDiscountSettlement,
  useLateFeeSettlement,
  useRefundSettlement,
  useSettlement,
  useSettlementAudit
} from '../hooks'
import { SETTLEMENT_STATUS_MAP } from '../statusMap'

const CHARGE_TYPE_LABELS: Record<string, string> = {
  RENTAL: 'إيجار',
  LATE: 'تأخير',
  DAMAGE: 'أضرار بسيطة',
  INITIAL_CREDIT: 'خصم الدفعة الأولية'
}

const PAYMENT_METHOD_LABELS: Record<SettlementPaymentMethod, string> = {
  CASH: 'نقد',
  CARD: 'بطاقة',
  BANK_TRANSFER: 'تحويل بنكي',
  OTHER: 'أخرى'
}

export default function SettlementDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = useAnyPermission(['rental.settlement.view', 'finance.settlement.view'])
  const canCollect = useAnyPermission([
    'rental.settlement.collect',
    'finance.settlement.manage'
  ])
  const canAdjust = useAnyPermission([
    'rental.settlement.adjust',
    'finance.adjustment',
    'finance.settlement.manage'
  ])
  const canAudit = usePermission('audit.view')
  const canViewRental = useAnyPermission(['rental.view', 'rentals.view'])

  const [payAmount, setPayAmount] = React.useState<number | null>(null)
  const [payMethod, setPayMethod] = React.useState<SettlementPaymentMethod>('CASH')
  const [adjustAmount, setAdjustAmount] = React.useState<number | null>(null)
  const [adjustReason, setAdjustReason] = React.useState('')
  const [refundAmount, setRefundAmount] = React.useState<number | null>(null)
  const [refundReason, setRefundReason] = React.useState('')
  const [discountAmount, setDiscountAmount] = React.useState<number | null>(null)
  const [discountReason, setDiscountReason] = React.useState('')
  const [lateFeeAmount, setLateFeeAmount] = React.useState<number | null>(null)
  const [lateFeeReason, setLateFeeReason] = React.useState('')

  const detail = useSettlement(id)
  const settlement = detail.data?.data
  const closedStatuses = new Set(['PAID', 'VOIDED', 'CLOSED', 'CANCELLED'])
  const isClosed = settlement ? closedStatuses.has(String(settlement.status).toUpperCase()) : false

  const collectMutation = useCollectSettlementPayment(id ?? '', settlement?.rental_id)
  const adjustMutation = useAdjustSettlement(id ?? '', settlement?.rental_id)
  const refundMutation = useRefundSettlement(id ?? '', settlement?.rental_id)
  const discountMutation = useDiscountSettlement(id ?? '', settlement?.rental_id)
  const lateFeeMutation = useLateFeeSettlement(id ?? '', settlement?.rental_id)
  const closeMutation = useCloseSettlement(id ?? '', settlement?.rental_id)
  const cancelMutation = useCancelSettlement(id ?? '', settlement?.rental_id)
  const audit = useSettlementAudit(id, canAudit)

  const rental = useQuery({
    queryKey: ['rentals', 'detail', settlement?.rental_id],
    queryFn: () => apiClient.rentals.get(settlement!.rental_id),
    enabled: Boolean(settlement?.rental_id)
  })

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/settlements" replace />

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !settlement ? (
        <ErrorState title="تعذّر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={settlement.settlement_number}
            description={rental.data?.data.rental_number ?? settlement.rental_id}
            status={{
              label: SETTLEMENT_STATUS_MAP[settlement.status]?.label ?? settlement.status,
              tone: SETTLEMENT_STATUS_MAP[settlement.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                {canViewRental ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate(`/rentals/${settlement.rental_id}`)}
                  >
                    التأجير المصدر
                  </Button>
                ) : null}
                {!isClosed ? (
                  <PermissionGuard anyOf={['finance.settlement.manage', 'rental.settlement.collect']}>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={closeMutation.isPending}
                      onClick={() => void closeMutation.mutateAsync({ reason: 'closed from UI' })}
                    >
                      إغلاق
                    </Button>
                  </PermissionGuard>
                ) : null}
                {!isClosed ? (
                  <PermissionGuard anyOf={['finance.settlement.manage', 'rental.settlement.adjust']}>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={cancelMutation.isPending}
                      onClick={() => void cancelMutation.mutateAsync({ reason: 'cancelled from UI' })}
                    >
                      إلغاء التسوية
                    </Button>
                  </PermissionGuard>
                ) : null}
              </div>
            }
          />

          <InlineMessage variant="info">
            جميع المبالغ من الخادم — لا تُعاد حسابها في الواجهة.
          </InlineMessage>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">الإجمالي الخام</p>
              <MoneyDisplay value={settlement.gross_total} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">المستحق</p>
              <MoneyDisplay value={settlement.total_due} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">المدفوع</p>
              <MoneyDisplay value={settlement.total_paid} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">المتبقي</p>
              <MoneyDisplay value={settlement.remaining_balance} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">إيجار</p>
              <MoneyDisplay value={settlement.rental_charge_amount} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">خصم الدفعة الأولية</p>
              <MoneyDisplay value={settlement.initial_payment_credit} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">غرامة تأخير</p>
              <MoneyDisplay value={settlement.late_penalty_amount} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">أضرار بسيطة</p>
              <MoneyDisplay value={settlement.minor_damage_penalty_amount} />
            </div>
            <div className="rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
              <p className="text-caption text-muted-foreground">تعديلات يدوية</p>
              <MoneyDisplay value={settlement.manual_adjustment_amount} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">الرسوم</h3>
                {(settlement.charges?.length ?? 0) === 0 ? (
                  <EmptyState title="لا رسوم" />
                ) : (
                  <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10 bg-base-300">
                    {settlement.charges.map((charge) => (
                      <li key={charge.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <div>
                          <p>{CHARGE_TYPE_LABELS[charge.charge_type] ?? charge.charge_type}</p>
                          {charge.description ? (
                            <p className="text-caption text-muted-foreground">{charge.description}</p>
                          ) : null}
                        </div>
                        <MoneyDisplay value={charge.amount} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">الدفعات</h3>
                {(settlement.payments?.length ?? 0) === 0 ? (
                  <EmptyState title="لا دفعات" />
                ) : (
                  <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10 bg-base-300">
                    {settlement.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <div>
                          <p>
                            {PAYMENT_METHOD_LABELS[payment.payment_method as SettlementPaymentMethod] ??
                              payment.payment_method}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {new Date(payment.received_at).toLocaleString('ar-IQ')}
                          </p>
                        </div>
                        <MoneyDisplay value={payment.amount} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">التعديلات</h3>
                {(settlement.adjustments?.length ?? 0) === 0 ? (
                  <EmptyState title="لا تعديلات" />
                ) : (
                  <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10 bg-base-300">
                    {settlement.adjustments.map((adj) => (
                      <li key={adj.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <p>{adj.reason}</p>
                        <MoneyDisplay value={adj.amount} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <PermissionGuard
                anyOf={['rental.settlement.collect', 'finance.settlement.manage']}
              >
                <section className="space-y-3 rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
                  <h3 className="text-title text-foreground">تحصيل دفعة</h3>
                  {isClosed ? (
                    <InlineMessage variant="info">التسوية مغلقة — لا يمكن تحصيل دفعات.</InlineMessage>
                  ) : (
                    <>
                      {collectMutation.isError ? (
                        <InlineMessage variant="danger">
                          {toAppError(collectMutation.error).message}
                        </InlineMessage>
                      ) : null}
                      <MoneyInput
                        value={payAmount}
                        onChange={setPayAmount}
                        label="المبلغ"
                        disabled={!canCollect || collectMutation.isPending}
                      />
                      <Select
                        value={payMethod}
                        onValueChange={(v) => setPayMethod(v as SettlementPaymentMethod)}
                        disabled={!canCollect || collectMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="طريقة الدفع" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(PAYMENT_METHOD_LABELS) as [SettlementPaymentMethod, string][]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        disabled={
                          !canCollect ||
                          collectMutation.isPending ||
                          payAmount == null ||
                          payAmount <= 0
                        }
                        onClick={async () => {
                          if (payAmount == null || payAmount <= 0) return
                          try {
                            await collectMutation.mutateAsync({
                              amount: payAmount,
                              payment_method: payMethod
                            })
                            setPayAmount(null)
                          } catch {
                            // inline + toast
                          }
                        }}
                      >
                        تسجيل الدفعة
                      </Button>
                    </>
                  )}
                </section>
              </PermissionGuard>

              <PermissionGuard
                anyOf={[
                  'rental.settlement.adjust',
                  'finance.adjustment',
                  'finance.settlement.manage'
                ]}
              >
                <section className="space-y-3 rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
                  <h3 className="text-title text-foreground">تعديل يدوي</h3>
                  {isClosed ? (
                    <InlineMessage variant="info">التسوية مغلقة — لا يمكن التعديل.</InlineMessage>
                  ) : (
                    <>
                      {adjustMutation.isError ? (
                        <InlineMessage variant="danger">
                          {toAppError(adjustMutation.error).message}
                        </InlineMessage>
                      ) : null}
                      <MoneyInput
                        value={adjustAmount}
                        onChange={setAdjustAmount}
                        label="المبلغ (موجب أو سالب)"
                        allowNegative
                        disabled={!canAdjust || adjustMutation.isPending}
                      />
                      <TextInput
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        placeholder="السبب (3 أحرف على الأقل)"
                        disabled={!canAdjust || adjustMutation.isPending}
                      />
                      <Button
                        type="button"
                        disabled={
                          !canAdjust ||
                          adjustMutation.isPending ||
                          adjustAmount == null ||
                          adjustAmount === 0 ||
                          adjustReason.trim().length < 3
                        }
                        onClick={async () => {
                          if (adjustAmount == null || adjustAmount === 0) return
                          try {
                            await adjustMutation.mutateAsync({
                              amount: adjustAmount,
                              reason: adjustReason.trim()
                            })
                            setAdjustAmount(null)
                            setAdjustReason('')
                          } catch {
                            // inline + toast
                          }
                        }}
                      >
                        تسجيل التعديل
                      </Button>
                    </>
                  )}
                </section>
              </PermissionGuard>

              <PermissionGuard anyOf={['finance.settlement.manage', 'finance.refund', 'rental.settlement.adjust']}>
                <section className="space-y-3 rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
                  <h3 className="text-title text-foreground">استرداد</h3>
                  {isClosed ? (
                    <InlineMessage variant="info">التسوية مغلقة</InlineMessage>
                  ) : (
                    <>
                      <MoneyInput
                        value={refundAmount}
                        onChange={setRefundAmount}
                        label="المبلغ"
                        disabled={refundMutation.isPending}
                      />
                      <TextInput
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="السبب"
                        disabled={refundMutation.isPending}
                      />
                      <Button
                        type="button"
                        disabled={
                          refundMutation.isPending ||
                          refundAmount == null ||
                          refundAmount <= 0 ||
                          refundReason.trim().length < 1
                        }
                        onClick={async () => {
                          if (refundAmount == null) return
                          await refundMutation.mutateAsync({
                            amountFils: refundAmount,
                            reason: refundReason.trim()
                          })
                          setRefundAmount(null)
                          setRefundReason('')
                        }}
                      >
                        تسجيل الاسترداد
                      </Button>
                    </>
                  )}
                </section>
              </PermissionGuard>

              <PermissionGuard anyOf={['finance.settlement.manage', 'finance.discount', 'rental.settlement.adjust']}>
                <section className="space-y-3 rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
                  <h3 className="text-title text-foreground">خصم ثابت</h3>
                  {isClosed ? (
                    <InlineMessage variant="info">التسوية مغلقة</InlineMessage>
                  ) : (
                    <>
                      <MoneyInput
                        value={discountAmount}
                        onChange={setDiscountAmount}
                        label="مبلغ الخصم"
                        disabled={discountMutation.isPending}
                      />
                      <TextInput
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="السبب"
                        disabled={discountMutation.isPending}
                      />
                      <Button
                        type="button"
                        disabled={
                          discountMutation.isPending ||
                          discountAmount == null ||
                          discountAmount <= 0 ||
                          discountReason.trim().length < 1
                        }
                        onClick={async () => {
                          if (discountAmount == null) return
                          await discountMutation.mutateAsync({
                            kind: 'fixed',
                            amountFils: discountAmount,
                            reason: discountReason.trim()
                          })
                          setDiscountAmount(null)
                          setDiscountReason('')
                        }}
                      >
                        تطبيق الخصم
                      </Button>
                    </>
                  )}
                </section>
              </PermissionGuard>

              <PermissionGuard anyOf={['finance.settlement.manage', 'finance.late_fee', 'rental.settlement.adjust']}>
                <section className="space-y-3 rounded-box border border-base-content/10 bg-base-300 p-4 shadow-sm">
                  <h3 className="text-title text-foreground">غرامة تأخير (مبلغ ثابت)</h3>
                  {isClosed ? (
                    <InlineMessage variant="info">التسوية مغلقة</InlineMessage>
                  ) : (
                    <>
                      <MoneyInput
                        value={lateFeeAmount}
                        onChange={setLateFeeAmount}
                        label="المبلغ"
                        disabled={lateFeeMutation.isPending}
                      />
                      <TextInput
                        value={lateFeeReason}
                        onChange={(e) => setLateFeeReason(e.target.value)}
                        placeholder="السبب"
                        disabled={lateFeeMutation.isPending}
                      />
                      <Button
                        type="button"
                        disabled={
                          lateFeeMutation.isPending ||
                          lateFeeAmount == null ||
                          lateFeeAmount <= 0 ||
                          lateFeeReason.trim().length < 1
                        }
                        onClick={async () => {
                          if (lateFeeAmount == null) return
                          await lateFeeMutation.mutateAsync({
                            kind: 'flat',
                            flatFils: lateFeeAmount,
                            reason: lateFeeReason.trim()
                          })
                          setLateFeeAmount(null)
                          setLateFeeReason('')
                        }}
                      >
                        احتساب الغرامة
                      </Button>
                    </>
                  )}
                </section>
              </PermissionGuard>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">سجل التدقيق</h3>
                {!canAudit ? (
                  <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
                ) : audit.isError ? (
                  <InlineMessage variant="warning">تعذّر تحميل سجل التدقيق</InlineMessage>
                ) : audit.isLoading ? (
                  <BusyIndicator label="جاري التحميل…" />
                ) : (audit.data?.data.length ?? 0) === 0 ? (
                  <EmptyState title="لا أحداث" />
                ) : (
                  <AuditTimeline
                    items={(audit.data?.data ?? []).map((row) => ({
                      id: row.id,
                      at: row.created_at,
                      actor: row.username ?? undefined,
                      action: row.action,
                      detail: row.message ?? undefined
                    }))}
                  />
                )}
              </section>
            </div>

            <RecordInfoPanel
              title="معلومات التسوية"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={settlement.status} map={SETTLEMENT_STATUS_MAP} />
                },
                {
                  id: 'rental',
                  label: 'التأجير',
                  value: rental.data?.data.rental_number ?? settlement.rental_id.slice(0, 8)
                },
                {
                  id: 'return',
                  label: 'المرتجع',
                  value: settlement.return_id.slice(0, 8)
                },
                {
                  id: 'settled',
                  label: 'تاريخ الإغلاق',
                  value: settlement.settled_at
                    ? new Date(settlement.settled_at).toLocaleString('ar-IQ')
                    : '—'
                },
                {
                  id: 'notes',
                  label: 'ملاحظات',
                  value: settlement.notes ?? '—'
                }
              ]}
              createdUpdated={{
                createdAt: settlement.created_at,
                updatedAt: settlement.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
