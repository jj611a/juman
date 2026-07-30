import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  EmptyState,
  ErrorState,
  Grid,
  KPICard,
  Page,
  PageHeader,
  Pagination,
  type DataPaginationState
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { ReportBarChart } from '../components/charts/ReportBarChart'
import { ReportPieChart } from '../components/charts/ReportPieChart'
import { ReportChrome } from '../components/ReportChrome'
import { useInventorySummaryReport, useNeverRentedReport } from '../hooks'

export default function InventoryReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const summary = useInventorySummaryReport(canView)
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const neverRentedParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'created_at' as const,
      sort_dir: 'desc' as const
    }),
    [pagination.pageIndex, pagination.pageSize]
  )

  const neverRented = useNeverRentedReport(neverRentedParams, canView)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = summary.data

  return (
    <Page size="full" as="main">
      <PageHeader title="تقرير المخزون" description="توزيع الفساتين — بدون فلتر تاريخ." />
      <ReportChrome showDateRange={false}>
        {summary.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : summary.isError ? (
          <ErrorState title="تعذر تحميل ملخص المخزون" onRetry={() => void summary.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="dresses_total" value={data.dresses_total} />
            </Grid>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_category</h3>
                <ReportBarChart
                  data={data.by_category.map((r) => ({ name: r.key, count: r.count }))}
                  categoryKey="name"
                  valueKey="count"
                  valueLabel="count"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_size</h3>
                <ReportPieChart
                  data={data.by_size.map((r) => ({ name: r.key, value: r.count }))}
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_colour</h3>
                <ReportPieChart
                  data={data.by_colour.map((r) => ({ name: r.key, value: r.count }))}
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-title text-foreground">by_brand</h3>
                <ReportBarChart
                  data={data.by_brand.map((r) => ({ name: r.key || '—', count: r.count }))}
                  categoryKey="name"
                  valueKey="count"
                  layout="vertical"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-title text-foreground">never_rented</h3>
              {neverRented.isLoading ? (
                <BusyIndicator label="جاري التحميل…" />
              ) : neverRented.isError ? (
                <ErrorState title="تعذر تحميل القائمة" onRetry={() => void neverRented.refetch()} />
              ) : (neverRented.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="لا فساتين بدون إيجار" />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-body">
                      <thead className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start">barcode</th>
                          <th className="px-3 py-2 text-start">name_ar</th>
                          <th className="px-3 py-2 text-start">size</th>
                          <th className="px-3 py-2 text-start">colour</th>
                          <th className="px-3 py-2 text-start">status</th>
                          <th className="px-3 py-2 text-start">created_at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(neverRented.data?.items ?? []).map((row) => (
                          <tr key={row.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2" dir="ltr">
                              {row.barcode}
                            </td>
                            <td className="px-3 py-2">{row.name_ar}</td>
                            <td className="px-3 py-2">{row.size}</td>
                            <td className="px-3 py-2">{row.colour}</td>
                            <td className="px-3 py-2">{row.status}</td>
                            <td className="px-3 py-2">
                              {new Date(row.created_at).toLocaleDateString('ar-IQ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {neverRented.data?.meta ? (
                    <Pagination
                      pagination={pagination}
                      totalItems={neverRented.data.meta.total}
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
