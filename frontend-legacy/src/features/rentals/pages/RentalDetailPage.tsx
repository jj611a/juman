import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AuditTimeline,
  Button,
  ConfirmationDialog,
  EmptyState,
  EntityHeader,
  ErrorState,
  InlineMessage,
  MoneyDisplay,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  StatusChip,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { useSettlementByRental } from '@/features/settlements/hooks'
import {
  useCancelRental,
  useCompleteRental,
  useRental,
  useRentalAudit,
  useReturnRental,
  useUpdateRental
} from '../hooks'
import { RENTAL_STATUS_MAP } from '../statusMap'

function statusUpper(s: string): string {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
}

export default function RentalDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = useAnyPermission(['rental.view', 'rentals.view'])
  const canAudit = useAnyPermission(['audit.view', 'rental.view', 'rentals.view'])
  const canEditNotes = useAnyPermission([
    'rentals.create',
    'rentals.checkout',
    'rental.create',
    'rental.update'
  ])
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [completeOpen, setCompleteOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [notesDraft, setNotesDraft] = React.useState('')
  const [notesEditing, setNotesEditing] = React.useState(false)

  const detail = useRental(id)
  const audit = useRentalAudit(id, canAudit)
  const returnMutation = useReturnRental()
  const completeMutation = useCompleteRental()
  const cancelMutation = useCancelRental()
  const updateMutation = useUpdateRental(id ?? '')
  const rental = detail.data?.data
  const st = rental ? statusUpper(String(rental.status)) : ''

  React.useEffect(() => {
    if (rental && !notesEditing) {
      setNotesDraft(rental.notes ?? '')
    }
  }, [rental, notesEditing])

  const settlement = useSettlementByRental(id)
  const customer = useQuery({
    queryKey: ['customers', 'detail', rental?.customer_id],
    queryFn: () => apiClient.customers.get(rental!.customer_id),
    enabled: Boolean(rental?.customer_id)
  })

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/rentals" replace />

  const canReturn = st === 'ACTIVE' || st === 'CHECKED_OUT' || st === 'OVERDUE'
  const canComplete = st === 'RETURN_PENDING'
  const canCancel =
    st === 'DRAFT' || st === 'ACTIVE' || st === 'CHECKED_OUT' || st === 'OVERDUE'

  const saveNotes = async (): Promise<void> => {
    const trimmed = notesDraft.trim()
    try {
      await updateMutation.mutateAsync(
        trimmed
          ? { notes: trimmed }
          : { notes: null, clear_notes: true }
      )
      setNotesEditing(false)
    } catch {
      /* toast handled by useUpdateRental.onError */
    }
  }

  return (
    <Page size="lg" as="main" className="animate-juman-in">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !rental ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={rental.rental_number}
            description={customer.data?.data.full_name ?? rental.customer_id}
            status={{
              label: RENTAL_STATUS_MAP[rental.status]?.label ?? rental.status,
              tone: RENTAL_STATUS_MAP[rental.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                {rental.reservation_id ? (
                  <PermissionGuard anyOf={['reservation.view', 'reservations.view']}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void navigate(`/reservations/${rental.reservation_id}`)}
                    >
                      الحجز المصدر
                    </Button>
                  </PermissionGuard>
                ) : null}
                {settlement.data?.data.id ? (
                  <PermissionGuard
                    anyOf={['rental.settlement.view', 'finance.settlement.view']}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void navigate(`/settlements/${settlement.data!.data.id}`)}
                    >
                      التسوية
                    </Button>
                  </PermissionGuard>
                ) : null}
                {canReturn ? (
                  <PermissionGuard anyOf={['rental.update', 'rentals.return', 'rentals.checkout']}>
                    <Button type="button" onClick={() => setReturnOpen(true)}>
                      إرجاع
                    </Button>
                  </PermissionGuard>
                ) : null}
                {canComplete ? (
                  <PermissionGuard anyOf={['rental.update', 'rentals.complete']}>
                    <Button type="button" onClick={() => setCompleteOpen(true)}>
                      إكمال
                    </Button>
                  </PermissionGuard>
                ) : null}
                {canCancel ? (
                  <PermissionGuard anyOf={['rental.cancel', 'rentals.cancel']}>
                    <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
                      إلغاء
                    </Button>
                  </PermissionGuard>
                ) : null}
              </div>
            }
          />

          {st === 'DRAFT' ? (
            <InlineMessage variant="warning">
              مسودة — أكمل التسليم من شاشة التأجير الجديد أو ألغِ المسودة.
            </InlineMessage>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="stats rounded-box border border-base-content/10 bg-base-300 shadow-sm">
              <div className="stat px-4 py-3">
                <div className="stat-title text-base-content/55">رسوم التأجير</div>
                <div className="stat-value text-lg">
                  <MoneyDisplay
                    value={
                      settlement.data?.data.rental_charge_amount ?? rental.estimated_total
                    }
                  />
                </div>
              </div>
            </div>
            <div className="stats rounded-box border border-base-content/10 bg-base-300 shadow-sm">
              <div className="stat px-4 py-3">
                <div className="stat-title text-base-content/55">الدفعة الأولية</div>
                <div className="stat-value text-lg">
                  <MoneyDisplay
                    value={
                      settlement.data?.data.initial_payment_credit ??
                      rental.initial_payment_value
                    }
                  />
                </div>
              </div>
            </div>
            <div className="stats rounded-box border border-base-content/10 bg-base-300 shadow-sm">
              <div className="stat px-4 py-3">
                <div className="stat-title text-base-content/55">المتبقي (تسوية)</div>
                <div className="stat-value text-lg text-primary">
                  <MoneyDisplay
                    value={
                      settlement.data?.data.remaining_balance ?? rental.remaining_balance
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">البنود</h3>
                {(rental.items?.length ?? 0) === 0 ? (
                  <EmptyState title="لا بنود" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {rental.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <div>
                          <button
                            type="button"
                            className="text-caption text-primary underline"
                            dir="ltr"
                            onClick={() => void navigate(`/inventory/${item.dress_id}`)}
                          >
                            {item.dress_id}
                          </button>
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

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-title text-foreground">ملاحظات</h3>
                  {canEditNotes && !notesEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotesDraft(rental.notes ?? '')
                        setNotesEditing(true)
                      }}
                    >
                      تعديل
                    </Button>
                  ) : null}
                </div>
                {notesEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="textarea textarea-bordered min-h-20 w-full resize-y bg-base-200 text-base-content"
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="ملاحظات التأجير"
                      rows={3}
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => void saveNotes()}
                      >
                        {updateMutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={updateMutation.isPending}
                        onClick={() => {
                          setNotesDraft(rental.notes ?? '')
                          setNotesEditing(false)
                        }}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p>{rental.notes?.trim() ? rental.notes : '—'}</p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">سجل التدقيق</h3>
                {!canAudit ? (
                  <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
                ) : audit.isError ? (
                  <InlineMessage variant="warning">تعذر تحميل سجل التدقيق</InlineMessage>
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
              title="معلومات التأجير"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={rental.status} map={RENTAL_STATUS_MAP} />
                },
                {
                  id: 'rental_at',
                  label: 'التسليم',
                  value: new Date(rental.rental_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'return',
                  label: 'الإعادة المتوقعة',
                  value: new Date(rental.expected_return_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'customer',
                  label: 'العميل',
                  value: (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => void navigate(`/customers/${rental.customer_id}`)}
                    >
                      {customer.data?.data.full_name ?? rental.customer_id.slice(0, 8)}
                    </button>
                  )
                }
              ]}
              createdUpdated={{
                createdAt: rental.created_at,
                updatedAt: rental.updated_at
              }}
            />
          </div>

          <ConfirmationDialog
            open={returnOpen}
            onOpenChange={setReturnOpen}
            title="تأكيد الإرجاع"
            description="سيتم تسجيل إرجاع البنود عبر Nest POST /rentals/:id/return"
            confirmLabel="إرجاع"
            onConfirm={async () => {
              await returnMutation.mutateAsync({ id })
              setReturnOpen(false)
            }}
            loading={returnMutation.isPending}
          />
          <ConfirmationDialog
            open={completeOpen}
            onOpenChange={setCompleteOpen}
            title="إكمال التأجير"
            description="يتطلب حالة return_pending بعد الإرجاع"
            confirmLabel="إكمال"
            onConfirm={async () => {
              await completeMutation.mutateAsync({ id })
              setCompleteOpen(false)
            }}
            loading={completeMutation.isPending}
          />
          <ConfirmationDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title="إلغاء التأجير"
            description={
              'سيُلغى التأجير ويبقى في القائمة بحالة «ملغى». ' +
              'تُبطل رسوم الإيجار والدفعة الأولية من الدفتر المالي وتُلغى التسوية، ' +
              'وتُعاد الفساتين للمخزون. لا يمكن الإلغاء إذا وُجد تحصيل نقدي على التسوية.'
            }
            confirmLabel="تأكيد الإلغاء"
            tone="danger"
            onConfirm={async () => {
              await cancelMutation.mutateAsync({ id })
              setCancelOpen(false)
            }}
            loading={cancelMutation.isPending}
          />
        </div>
      )}
    </Page>
  )
}
