import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  EmptyState,
  ErrorState,
  Grid,
  KPICard,
  Page,
  PageHeader
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { ReportChrome } from '../components/ReportChrome'
import { useReportDateRange, useReservationsSummaryReport } from '../hooks'

export default function ReservationsReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const query = useReservationsSummaryReport(params, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = query.data

  return (
    <Page size="lg" as="main">
      <PageHeader title="تقرير الحجوزات" description="حجوزات أُنشئت خلال الفترة." />
      <ReportChrome
        dateFrom={from}
        dateTo={to}
        onDateFromChange={(d) => d && setFrom(d)}
        onDateToChange={(d) => d && setTo(d)}
      >
        {!isValid ? (
          <EmptyState title="نطاق تاريخ غير صالح" />
        ) : query.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : query.isError ? (
          <ErrorState title="تعذر تحميل تقرير الحجوزات" onRetry={() => void query.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="created_in_range_total" value={data.created_in_range_total} />
              <KPICard title="upcoming_confirmed" value={data.upcoming_confirmed} />
            </Grid>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">by_customer</h3>
              {(data.by_customer.length ?? 0) === 0 ? (
                <EmptyState title="لا by_customer" />
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.by_customer.map((row) => (
                    <li key={row.customer_id} className="flex justify-between gap-2 px-4 py-3">
                      <span>
                        {row.full_name} ({row.customer_number})
                      </span>
                      <span className="tabular-nums text-muted-foreground">count: {row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">by_cashier</h3>
              {(data.by_cashier.length ?? 0) === 0 ? (
                <EmptyState title="لا by_cashier" />
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.by_cashier.map((row) => (
                    <li key={row.cashier_id} className="flex justify-between gap-2 px-4 py-3">
                      <span dir="ltr">{row.cashier_id}</span>
                      <span className="tabular-nums text-muted-foreground">count: {row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
