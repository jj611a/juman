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
import { usePermission } from '@/hooks/usePermission'
import { ReportBarChart } from '../components/charts/ReportBarChart'
import { ReportChrome } from '../components/ReportChrome'
import { SALES_SUMMARY_MONEY_KEYS } from '../fieldLabels'
import { useReportDateRange, useSalesDetailsReport, useSalesSummaryReport } from '../hooks'

export default function SalesReportPage(): React.ReactElement {
  const canView = usePermission('reports.financial.view')
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const summary = useSalesSummaryReport(params, canView && isValid)
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const detailsParams = React.useMemo(
    () => ({
      ...params,
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'sold_at' as const,
      sort_dir: 'desc' as const
    }),
    [params, pagination.pageIndex, pagination.pageSize]
  )

  const details = useSalesDetailsReport(detailsParams, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = summary.data

  return (
    <Page size="full" as="main">
      <PageHeader title="تقرير المبيعات" description="sale_revenue والتفاصيل — reports.financial.view" />
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
          <ErrorState title="تعذر تحميل ملخص المبيعات" onRetry={() => void summary.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="sales_count" value={data.sales_count} />
              {SALES_SUMMARY_MONEY_KEYS.map((key) => (
                <KPICard
                  key={key}
                  title={key}
                  value={<MoneyDisplay value={data[key]} />}
                />
              ))}
              <KPICard
                title="average_sale_value"
                value={
                  data.average_sale_value != null ? (
                    <MoneyDisplay value={Math.round(data.average_sale_value)} />
                  ) : (
                    '—'
                  )
                }
              />
              <KPICard title="override_line_count" value={data.override_line_count} />
            </Grid>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_cashier</h3>
                {(data.by_cashier.length ?? 0) === 0 ? (
                  <EmptyState title="لا by_cashier" />
                ) : (
                  <ReportBarChart
                    data={data.by_cashier.map((r) => ({
                      name: r.cashier_id,
                      total_amount: r.total_amount
                    }))}
                    categoryKey="name"
                    valueKey="total_amount"
                    valueLabel="total_amount"
                    layout="vertical"
                  />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_category</h3>
                {(data.by_category.length ?? 0) === 0 ? (
                  <EmptyState title="لا by_category" />
                ) : (
                  <ReportBarChart
                    data={data.by_category.map((r) => ({
                      name: r.category,
                      total_amount: r.total_amount
                    }))}
                    categoryKey="name"
                    valueKey="total_amount"
                    valueLabel="total_amount"
                  />
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">sales/details</h3>
              {details.isLoading ? (
                <BusyIndicator label="جاري التحميل…" />
              ) : details.isError ? (
                <ErrorState title="تعذر تحميل التفاصيل" onRetry={() => void details.refetch()} />
              ) : (details.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="لا مبيعات في الفترة" />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-body">
                      <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start">sale_number</th>
                          <th className="px-3 py-2 text-start">origin</th>
                          <th className="px-3 py-2 text-start">status</th>
                          <th className="px-3 py-2 text-start">sold_at</th>
                          <th className="px-3 py-2 text-start">total_amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(details.data?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{row.sale_number}</td>
                            <td className="px-3 py-2">{row.origin}</td>
                            <td className="px-3 py-2">{row.status}</td>
                            <td className="px-3 py-2">
                              {new Date(row.sold_at).toLocaleString('ar-IQ')}
                            </td>
                            <td className="px-3 py-2">
                              <MoneyDisplay value={row.total_amount} />
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
