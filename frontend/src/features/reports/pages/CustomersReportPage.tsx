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
import { ReportBarChart } from '../components/charts/ReportBarChart'
import { ReportChrome } from '../components/ReportChrome'
import {
  useCustomersSummaryReport,
  useCustomersTopReport,
  useReportDateRange
} from '../hooks'

export default function CustomersReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const summary = useCustomersSummaryReport(params, canView && isValid)
  const top = useCustomersTopReport({ metric: 'rental_count', limit: 10 }, canView)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = summary.data
  const topItems = top.data?.items ?? []

  return (
    <Page size="lg" as="main">
      <PageHeader title="تقرير العملاء" description="إحصاءات العملاء والأكثر rental_count." />
      <ReportChrome
        dateFrom={from}
        dateTo={to}
        onDateFromChange={(d) => d && setFrom(d)}
        onDateToChange={(d) => d && setTo(d)}
      >
        {!isValid ? (
          <EmptyState title="نطاق تاريخ غير صالح" />
        ) : summary.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : summary.isError ? (
          <ErrorState title="تعذر تحميل تقرير العملاء" onRetry={() => void summary.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="total_customers" value={data.total_customers} />
              <KPICard title="new_in_range" value={data.new_in_range} />
              <KPICard title="with_active_rentals" value={data.with_active_rentals} />
              <KPICard title="with_overdue_rentals" value={data.with_overdue_rentals} />
            </Grid>

            <section className="space-y-2">
              <h3 className="text-title text-foreground">customers/top (metric=rental_count)</h3>
              {top.isLoading ? (
                <BusyIndicator label="جاري التحميل…" />
              ) : top.isError ? (
                <ErrorState title="تعذر تحميل الأعلى" onRetry={() => void top.refetch()} />
              ) : topItems.length === 0 ? (
                <EmptyState title="لا بيانات" />
              ) : (
                <ReportBarChart
                  data={topItems.map((r) => ({
                    name: r.full_name,
                    value: r.value
                  }))}
                  categoryKey="name"
                  valueKey="value"
                  valueLabel="value"
                  layout="vertical"
                />
              )}
            </section>
          </div>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
