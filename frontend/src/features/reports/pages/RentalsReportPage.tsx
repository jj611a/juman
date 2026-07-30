import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  EmptyState,
  ErrorState,
  Grid,
  KPICard,
  MoneyDisplay,
  Page,
  PageHeader,
  Pagination,
  type DataPaginationState
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { ReportBarChart } from '../components/charts/ReportBarChart'
import { ReportChrome } from '../components/ReportChrome'
import { useRentalsDetailsReport, useRentalsSummaryReport, useReportDateRange } from '../hooks'

export default function RentalsReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const summary = useRentalsSummaryReport(params, canView && isValid)
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const detailsParams = React.useMemo(
    () => ({
      ...params,
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'rental_at' as const,
      sort_dir: 'desc' as const
    }),
    [params, pagination.pageIndex, pagination.pageSize]
  )

  const details = useRentalsDetailsReport(detailsParams, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = summary.data

  return (
    <Page size="full" as="main">
      <PageHeader title="تقرير الإيجارات" description="ملخص الفترة وتفاصيل الإيجارات." />
      <ReportChrome
        dateFrom={from}
        dateTo={to}
        onDateFromChange={(d) => d && setFrom(d)}
        onDateToChange={(d) => d && setTo(d)}
      >
        {!isValid ? (
          <EmptyState title="نطاق تاريخ غير صالح" description="يجب أن يكون «من» قبل أو يساوي «إلى»." />
        ) : summary.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : summary.isError ? (
          <ErrorState title="تعذر تحميل ملخص الإيجارات" onRetry={() => void summary.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="created_in_range_total" value={data.created_in_range_total} />
              <KPICard title="active_now" value={data.active_now} />
              <KPICard title="overdue_now" value={data.overdue_now} />
              <KPICard title="completed_settled_in_range" value={data.completed_settled_in_range} />
            </Grid>

            <section className="space-y-2">
              <h3 className="text-title text-foreground">most_rented</h3>
              {(data.most_rented.length ?? 0) === 0 ? (
                <EmptyState title="لا بيانات most_rented" />
              ) : (
                <ReportBarChart
                  data={data.most_rented.map((r) => ({
                    name: r.name_ar,
                    rental_count: r.rental_count
                  }))}
                  categoryKey="name"
                  valueKey="rental_count"
                  valueLabel="rental_count"
                  layout="vertical"
                />
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">rentals/details</h3>
              {details.isLoading ? (
                <BusyIndicator label="جاري التحميل…" />
              ) : details.isError ? (
                <ErrorState title="تعذر تحميل التفاصيل" onRetry={() => void details.refetch()} />
              ) : (details.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="لا إيجارات في الفترة" />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-body">
                      <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start">rental_number</th>
                          <th className="px-3 py-2 text-start">status</th>
                          <th className="px-3 py-2 text-start">rental_at</th>
                          <th className="px-3 py-2 text-start">expected_return_at</th>
                          <th className="px-3 py-2 text-start">estimated_total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details.data?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{row.rental_number}</td>
                            <td className="px-3 py-2">{row.status}</td>
                            <td className="px-3 py-2">
                              {new Date(row.rental_at).toLocaleString('ar-IQ')}
                            </td>
                            <td className="px-3 py-2">
                              {new Date(row.expected_return_at).toLocaleString('ar-IQ')}
                            </td>
                            <td className="px-3 py-2">
                              <MoneyDisplay value={row.estimated_total} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {details.data?.meta ? (
                    <Pagination
                      pagination={pagination}
                      totalItems={details.data.meta.total}
                      onPaginationChange={setPagination}
                    />
                  ) : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
