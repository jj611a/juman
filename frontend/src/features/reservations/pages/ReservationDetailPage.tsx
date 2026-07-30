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
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { AvailabilityPreview } from '../components/AvailabilityPreview'
import {
  useCancelReservation,
  useConfirmReservation,
  useExpireReservation,
  useReservation,
  useReservationAudit
} from '../hooks'
import { RESERVATION_STATUS_MAP } from '../statusMap'

export default function ReservationDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('reservation.view')
  const canAudit = usePermission('audit.view')
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [allAvailable, setAllAvailable] = React.useState<boolean | null>(null)

  const detail = useReservation(id)
  const audit = useReservationAudit(id, canAudit)
  const confirmMutation = useConfirmReservation()
  const cancelMutation = useCancelReservation()
  const expireMutation = useExpireReservation()

  const reservation = detail.data?.data
  const customer = useQuery({
    queryKey: ['customers', 'detail', reservation?.customer_id],
    queryFn: () => apiClient.customers.get(reservation!.customer_id),
    enabled: Boolean(reservation?.customer_id)
  })

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { limit: 200 }],
    queryFn: () => apiClient.dresses.list({ page: 1, page_size: 200 }),
    enabled: Boolean(reservation)
  })
  const dressName = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const d of dresses.data?.data ?? []) m.set(d.id, d.name_ar)
    return m
  }, [dresses.data])

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/reservations" replace />

  const isDraft = reservation?.status === 'DRAFT'
  const isConfirmed = reservation?.status === 'CONFIRMED'

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !reservation ? (
        <ErrorState
          title="تعذر تحميل الحجز"
          message="السجل غير متاح"
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={reservation.reservation_number}
            description={customer.data?.data.full_name ?? reservation.customer_id}
            status={{
              label: RESERVATION_STATUS_MAP[reservation.status]?.label ?? reservation.status,
              tone: RESERVATION_STATUS_MAP[reservation.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                {isDraft ? (
                  <PermissionGuard permission="reservation.update">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void navigate(`/reservations/${id}/edit`)}
                    >
                      تعديل
                    </Button>
                  </PermissionGuard>
                ) : null}
                {isDraft ? (
                  <PermissionGuard permission="reservation.update">
                    <Button
                      type="button"
                      disabled={allAvailable === false || confirmMutation.isPending}
                      onClick={() => void confirmMutation.mutateAsync(id)}
                    >
                      تأكيد
                    </Button>
                  </PermissionGuard>
                ) : null}
                {isConfirmed ? (
                  <PermissionGuard permission="rental.create">
                    <Button
                      type="button"
                      onClick={() => void navigate(`/rentals/new?reservationId=${id}`)}
                    >
                      تحويل لتأجير
                    </Button>
                  </PermissionGuard>
                ) : null}
                {isConfirmed ? (
                  <PermissionGuard permission="reservation.update">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={expireMutation.isPending}
                      onClick={() => void expireMutation.mutateAsync(id)}
                    >
                      إنهاء
                    </Button>
                  </PermissionGuard>
                ) : null}
                {isDraft || isConfirmed ? (
                  <PermissionGuard permission="reservation.cancel">
                    <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
                      إلغاء
                    </Button>
                  </PermissionGuard>
                ) : null}
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">الفساتين</h3>
                {(reservation.items?.length ?? 0) === 0 ? (
                  <EmptyState title="لا بنود" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {reservation.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <div>
                          <p>{dressName.get(item.dress_id) ?? item.dress_id.slice(0, 8)}</p>
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
                        <MoneyDisplay value={item.reserved_daily_rental_price} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isDraft ? (
                <AvailabilityPreview
                  dressIds={reservation.items.map((i) => i.dress_id)}
                  startAt={reservation.rental_start_at}
                  endAt={reservation.expected_return_at}
                  onAllAvailableChange={setAllAvailable}
                />
              ) : null}
              {isDraft && allAvailable === false ? (
                <InlineMessage variant="warning">
                  التأكيد معطّل حتى تصبح الفترة متاحة حسب التقويم.
                </InlineMessage>
              ) : null}

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
              title="معلومات الحجز"
              metaItems={[
                { id: 'status', label: 'الحالة', value: <StatusChip status={reservation.status} map={RESERVATION_STATUS_MAP} /> },
                {
                  id: 'reservation_at',
                  label: 'وقت الحجز',
                  value: new Date(reservation.reservation_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'start',
                  label: 'بداية الإيجار',
                  value: new Date(reservation.rental_start_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'end',
                  label: 'الإعادة المتوقعة',
                  value: new Date(reservation.expected_return_at).toLocaleString('ar-IQ')
                },
                { id: 'notes', label: 'ملاحظات', value: reservation.notes ?? '—' }
              ]}
              createdUpdated={{
                createdAt: reservation.created_at,
                updatedAt: reservation.updated_at
              }}
            />
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="إلغاء الحجز؟"
        description="سيتم إلغاء الحجز وإطلاق أي حجز تقويمي إن وُجد."
        confirmLabel="إلغاء الحجز"
        tone="danger"
        onConfirm={async () => {
          await cancelMutation.mutateAsync(id)
          setCancelOpen(false)
        }}
      />
    </Page>
  )
}
