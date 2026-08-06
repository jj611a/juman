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
  PageHeader
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { ReportPieChart } from '../components/charts/ReportPieChart'
import { ReportChrome } from '../components/ReportChrome'
import { useInspectionsSummaryReport, useReportDateRange } from '../hooks'

export default function InspectionsReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const query = useInspectionsSummaryReport(params, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = query.data
  const conditionPie = data
    ? Object.entries(data.items_by_condition).map(([name, value]) => ({ name, value }))
    : []

  return (
    <Page size="lg" as="main">
      <PageHeader title="تقرير الفحوصات" description="items_by_condition و KPIs من الخادم." />
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
          <ErrorState title="تعذر تحميل تقرير الفحوصات" onRetry={() => void query.refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              <KPICard title="inspections_completed" value={data.inspections_completed} />
              <KPICard
                title="minor_repair_penalties_total"
                value={<MoneyDisplay value={data.minor_repair_penalties_total} />}
              />
            </Grid>

            <section className="space-y-2">
              <h3 className="text-title text-foreground">items_by_condition</h3>
              {conditionPie.length === 0 ? (
                <EmptyState title="لا items_by_condition" />
              ) : (
                <ReportPieChart data={conditionPie} />
              )}
            </section>
          </div>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
