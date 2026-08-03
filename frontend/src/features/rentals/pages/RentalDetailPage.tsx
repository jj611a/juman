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
  Page,
  PermissionGuard,
  RecordInfoPanel,
  StatusChip,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { useRental, useRentalAudit, useUpdateRental } from '../hooks'
import { RENTAL_STATUS_MAP } from '../statusMap'

export default function RentalDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = useAnyPermission(['rental.view', 'rentals.view'])
  const canAudit = usePermission('audit.view')
  const canUpdate = useAnyPermission(['rental.update', 'rentals.checkout'])
  const [notes, setNotes] = React.useState('')
  const [editingNotes, setEditingNotes] = React.useState(false)

  const detail = useRental(id)
  const audit = useRentalAudit(id, canAudit)
  const updateMutation = useUpdateRental(id ?? '')
  const rental = detail.data?.data

  React.useEffect(() => {
    if (rental) setNotes(rental.notes ?? '')
  }, [rental])

  const customer = useQuery({
    queryKey: ['customers', 'detail', rental?.customer_id],
    queryFn: () => apiClient.customers.get(rental!.customer_id),
    enabled: Boolean(rental?.customer_id)
  })

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/rentals" replace />

  return (
    <Page size="lg" as="main">
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
              </div>
            }
          />

          <InlineMessage variant="info">
            إلغاء التأجير بعد التسليم غير مدعوم في الواجهة — استخدم وحدة المرتجعات لاحقاً.
          </InlineMessage>

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
                          <p dir="ltr" className="text-caption text-muted-foreground">
                            {item.dress_id}
                          </p>
                          <p className="text-caption">
                            أيام متوقعة (من الخادم): {item.expected_rental_days}
                          </p>
                          <PermissionGuard permission="calendar.view">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void navigate(`/calendar/${item.dress_id}`)}
                            >
                              التقويم
                            </Button>
                          </PermissionGuard>
                        </div>
                        <MoneyDisplay value={item.agreed_daily_rental_price} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">ملاحظات</h3>
                {canUpdate &&
                (rental.status === 'ACTIVE' || rental.status === 'CHECKED_OUT') ? (
                  editingNotes ? (
                    <div className="space-y-2">
                      <TextInput
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={async () => {
                            await updateMutation.mutateAsync({
                              notes: notes.trim() || null,
                              clear_notes: !notes.trim()
                            })
                            setEditingNotes(false)
                          }}
                        >
                          حفظ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setNotes(rental.notes ?? '')
                            setEditingNotes(false)
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p>{rental.notes ?? '—'}</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingNotes(true)}>
                        تعديل
                      </Button>
                    </div>
                  )
                ) : (
                  <p>{rental.notes ?? '—'}</p>
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
                  id: 'pay_type',
                  label: 'نوع الدفعة',
                  value: rental.initial_payment_type
                },
                {
                  id: 'rate',
                  label: 'نسبة الدفعة',
                  value: rental.initial_payment_rate != null ? `${rental.initial_payment_rate}%` : '—'
                }
              ]}
              createdUpdated={{
                createdAt: rental.created_at,
                updatedAt: rental.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
