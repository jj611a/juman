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
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import { useSale, useSaleAudit } from '../hooks'
import { SALE_ORIGIN_MAP, SALE_PAYMENT_METHOD_LABELS, SALE_STATUS_MAP } from '../statusMap'

export default function SaleDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('sale.view')
  const canAudit = usePermission('audit.view')
  const canViewInventory = usePermission('inventory.view')
  const canViewCustomer = usePermission('customer.view')
  const canViewInspection = usePermission('inspection.view')
  const canViewReturn = usePermission('return.view')
  const canViewRental = usePermission('rental.view')

  const detail = useSale(id)
  const audit = useSaleAudit(id, canAudit)
  const sale = detail.data?.data

  const customer = useQuery({
    queryKey: ['customers', 'detail', sale?.customer_id],
    queryFn: () => apiClient.customers.get(sale!.customer_id!),
    enabled: Boolean(sale?.customer_id)
  })

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/sales" replace />

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !sale ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={sale.sale_number}
            description={customer.data?.data.full_name ?? sale.customer_id ?? 'بدون عميل'}
            status={{
              label: SALE_STATUS_MAP[sale.status]?.label ?? sale.status,
              tone: SALE_STATUS_MAP[sale.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                {sale.inspection_id ? (
                  <PermissionGuard permission="inspection.view">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void navigate(`/processing/inspections/${sale.inspection_id}`)}
                    >
                      الفحص المصدر
                    </Button>
                  </PermissionGuard>
                ) : null}
                {sale.return_id ? (
                  <PermissionGuard permission="return.view">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void navigate(`/returns/${sale.return_id}`)}
                    >
                      المرتجع المصدر
                    </Button>
                  </PermissionGuard>
                ) : null}
                {sale.rental_id ? (
                  <PermissionGuard permission="rental.view">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void navigate(`/rentals/${sale.rental_id}`)}
                    >
                      التأجير المصدر
                    </Button>
                  </PermissionGuard>
                ) : null}
              </div>
            }
          />

          <div className="rounded-md border border-border p-4">
            <p className="text-caption text-muted-foreground">إجمالي الفاتورة</p>
            <MoneyDisplay value={sale.total_amount} className="text-title" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">البنود</h3>
                {(sale.items?.length ?? 0) === 0 ? (
                  <EmptyState title="لا بنود" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {sale.items.map((item) => (
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
                        <div className="text-end">
                          <p className="text-caption text-muted-foreground">السعر الافتراضي</p>
                          <MoneyDisplay value={item.default_sale_price} />
                          <p className="text-caption text-muted-foreground">سعر البيع</p>
                          <MoneyDisplay value={item.actual_sale_price} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">المدفوعات</h3>
                {(sale.payments?.length ?? 0) === 0 ? (
                  <EmptyState title="لا مدفوعات" />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {sale.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {SALE_PAYMENT_METHOD_LABELS[payment.payment_method] ??
                              payment.payment_method}
                          </p>
                          {payment.reference_number ? (
                            <p className="text-caption text-muted-foreground" dir="ltr">
                              {payment.reference_number}
                            </p>
                          ) : null}
                          {payment.notes ? (
                            <p className="text-caption text-muted-foreground">{payment.notes}</p>
                          ) : null}
                        </div>
                        <div className="text-end">
                          <MoneyDisplay value={payment.amount} />
                          <p className="text-caption text-muted-foreground">
                            {new Date(payment.received_at).toLocaleString('ar-IQ')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {sale.notes ? (
                <section className="space-y-3">
                  <h3 className="text-title text-foreground">ملاحظات</h3>
                  <p>{sale.notes}</p>
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
              title="معلومات البيع"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={sale.status} map={SALE_STATUS_MAP} />
                },
                {
                  id: 'origin',
                  label: 'المصدر',
                  value: <StatusChip status={sale.origin} map={SALE_ORIGIN_MAP} />
                },
                {
                  id: 'sold_at',
                  label: 'وقت البيع',
                  value: new Date(sale.sold_at).toLocaleString('ar-IQ')
                },
                {
                  id: 'customer',
                  label: 'العميل',
                  value:
                    sale.customer_id && canViewCustomer ? (
                      <button
                        type="button"
                        className="text-brand underline-offset-2 hover:underline"
                        onClick={() => void navigate(`/customers/${sale.customer_id}`)}
                      >
                        {customer.data?.data.full_name ?? sale.customer_id.slice(0, 8)}
                      </button>
                    ) : sale.customer_id ? (
                      sale.customer_id.slice(0, 8)
                    ) : (
                      '—'
                    )
                },
                {
                  id: 'inspection',
                  label: 'الفحص',
                  value:
                    sale.inspection_id && canViewInspection ? (
                      <button
                        type="button"
                        className="text-brand underline-offset-2 hover:underline"
                        onClick={() =>
                          void navigate(`/processing/inspections/${sale.inspection_id}`)
                        }
                      >
                        {sale.inspection_id.slice(0, 8)}…
                      </button>
                    ) : sale.inspection_id ? (
                      sale.inspection_id.slice(0, 8)
                    ) : (
                      '—'
                    )
                },
                {
                  id: 'return',
                  label: 'المرتجع',
                  value:
                    sale.return_id && canViewReturn ? (
                      <button
                        type="button"
                        className="text-brand underline-offset-2 hover:underline"
                        onClick={() => void navigate(`/returns/${sale.return_id}`)}
                      >
                        {sale.return_id.slice(0, 8)}…
                      </button>
                    ) : sale.return_id ? (
                      sale.return_id.slice(0, 8)
                    ) : (
                      '—'
                    )
                },
                {
                  id: 'rental',
                  label: 'التأجير',
                  value:
                    sale.rental_id && canViewRental ? (
                      <button
                        type="button"
                        className="text-brand underline-offset-2 hover:underline"
                        onClick={() => void navigate(`/rentals/${sale.rental_id}`)}
                      >
                        {sale.rental_id.slice(0, 8)}…
                      </button>
                    ) : sale.rental_id ? (
                      sale.rental_id.slice(0, 8)
                    ) : (
                      '—'
                    )
                },
                {
                  id: 'items_count',
                  label: 'عدد البنود',
                  value: String(sale.items?.length ?? 0)
                }
              ]}
              createdUpdated={{
                createdAt: sale.created_at,
                updatedAt: sale.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
