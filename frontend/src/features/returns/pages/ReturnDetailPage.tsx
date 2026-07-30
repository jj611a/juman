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
  Page,
  PermissionGuard,
  RecordInfoPanel,
  StatusChip,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { useReturn, useReturnAudit } from '../hooks'
import { RETURN_STATUS_MAP } from '../statusMap'

export default function ReturnDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('return.view')
  const canAudit = usePermission('audit.view')
  const canViewInventory = usePermission('inventory.view')
  const canViewRental = usePermission('rental.view')

  const detail = useReturn(id)
  const audit = useReturnAudit(id, canAudit)
  const ret = detail.data?.data

  const customer = useQuery({
    queryKey: ['customers', 'detail', ret?.customer_id],
    queryFn: () => apiClient.customers.get(ret!.customer_id),
    enabled: Boolean(ret?.customer_id)
  })

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/returns" replace />

  const isPendingInspection = ret?.status === 'PENDING_INSPECTION'

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !ret ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={ret.return_number}
            description={customer.data?.data.full_name ?? ret.customer_id}
            status={{
              label: RETURN_STATUS_MAP[ret.status]?.label ?? ret.status,
              tone: RETURN_STATUS_MAP[ret.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                <PermissionGuard permission="rental.view">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate(`/rentals/${ret.rental_id}`)}
                  >
                    التأجير المصدر
                  </Button>
                </PermissionGuard>
                {isPendingInspection ? (
                  <PermissionGuard permission="inspection.create">
                    <Button
                      type="button"
                      onClick={() =>
                        void navigate(`/processing/inspections/new?returnId=${ret.id}`)
                      }
                    >
                      بدء الفحص
                    </Button>
                  </PermissionGuard>
                ) : null}
                {isPendingInspection ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void navigate('/processing')}
                  >
                    لوحة المعالجة
                  </Button>
                ) : null}
              </div>
            }
          />

          <InlineMessage variant="info">
            التسوية المالية والفحص يتمّان في وحدات منفصلة — لا تُعرض مبالغ على سجل المرتجع.
          </InlineMessage>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">البنود</h3>
                {(ret.items?.length ?? 0) === 0 ? (
                  <EmptyState title="لا بنود" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {ret.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <div>
                          {canViewInventory ? (
                            <button
                              type="button"
                              dir="ltr"
                              className="text-brand underline-offset-2 hover:underline"
                              onClick={() => void navigate(`/inventory/${item.dress_id}`)}
                            >
                              {item.dress_id}
                            </button>
                          ) : (
                            <p dir="ltr" className="text-caption text-muted-foreground">
                              {item.dress_id}
                            </p>
                          )}
                          {item.notes ? (
                            <p className="text-caption text-muted-foreground">{item.notes}</p>
                          ) : null}
                        </div>
                        <p className="text-caption text-muted-foreground">
                          {new Date(item.returned_at).toLocaleString('ar-IQ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {ret.notes ? (
                <section className="space-y-3">
                  <h3 className="text-title text-foreground">ملاحظات</h3>
                  <p>{ret.notes}</p>
                </section>
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
              title="معلومات المرتجع"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={ret.status} map={RETURN_STATUS_MAP} />
                },
                {
                  id: 'returned_at',
                  label: 'وقت الإرجاع',
                  value: new Date(ret.returned_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'rental',
                  label: 'التأجير',
                  value: canViewRental ? (
                    <button
                      type="button"
                      className="text-brand underline-offset-2 hover:underline"
                      onClick={() => void navigate(`/rentals/${ret.rental_id}`)}
                    >
                      {ret.rental_id.slice(0, 8)}…
                    </button>
                  ) : (
                    ret.rental_id.slice(0, 8)
                  )
                },
                {
                  id: 'items_count',
                  label: 'عدد البنود',
                  value: String(ret.items?.length ?? 0)
                }
              ]}
              createdUpdated={{
                createdAt: ret.created_at,
                updatedAt: ret.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
