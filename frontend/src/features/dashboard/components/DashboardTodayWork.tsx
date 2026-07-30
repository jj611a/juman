import * as React from 'react'
import { Link } from 'react-router'
import { BusyIndicator, ErrorState, InlineMessage } from '@/components/ui'
import { usePermission, useAnyPermission } from '@/hooks/usePermission'
import { useDashboardReport } from '@/features/reports/hooks'

type WorkRow = { label: string; count: number; to: string; show: boolean }

export function DashboardTodayWork(): React.ReactElement {
  const canReports = usePermission('reports.view')
  const canRentals = usePermission('rental.view')
  const canReservations = usePermission('reservation.view')
  const canProcessing = useAnyPermission(['processing.view', 'inspection.view'])
  const query = useDashboardReport(canReports)

  if (!canReports) {
    return (
      <section aria-labelledby="dash-today-heading" className="space-y-3">
        <h2 id="dash-today-heading" className="text-title text-foreground">
          عمل اليوم
        </h2>
        <InlineMessage variant="info">لا تملك صلاحية عرض التقارير</InlineMessage>
      </section>
    )
  }

  const data = query.data
  const rows: WorkRow[] = data
    ? [
        {
          label: 'مستحق اليوم',
          count: data.rentals_due_today,
          to: '/rentals',
          show: canRentals
        },
        {
          label: 'حجوزات اليوم',
          count: data.reservations_today,
          to: '/reservations',
          show: canReservations
        },
        {
          label: 'دفعات معالجة جارية',
          count: data.processing_batches_in_process,
          to: '/processing',
          show: canProcessing
        },
        {
          label: 'فساتين قيد المعالجة',
          count: data.dresses_in_processing,
          to: '/processing',
          show: canProcessing
        },
        {
          label: 'متأخرة',
          count: data.rentals_overdue,
          to: '/rentals',
          show: canRentals
        }
      ].filter((r) => r.show)
    : []

  return (
    <section aria-labelledby="dash-today-heading" className="space-y-3">
      <h2 id="dash-today-heading" className="text-title text-foreground">
        عمل اليوم
      </h2>
      {query.isLoading ? <BusyIndicator label="جاري التحميل…" /> : null}
      {query.isError ? (
        <ErrorState title="تعذر تحميل عمل اليوم" message="تحقق من الاتصال ثم أعد المحاولة" onRetry={() => void query.refetch()} />
      ) : null}
      {data && rows.length === 0 ? (
        <InlineMessage variant="info">لا توجد عناصر عمل متاحة لصلاحياتك</InlineMessage>
      ) : null}
      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                to={row.to}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-body text-foreground hover:bg-secondary/60"
              >
                <span>{row.label}</span>
                <span className="font-medium tabular-nums text-brand" dir="ltr">
                  {row.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
