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
import { useProcessingSummaryReport, useReportDateRange } from '../hooks'

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default function ProcessingReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const query = useProcessingSummaryReport(params, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = query.data

  return (
    <Page size="lg" as="main">
      <PageHeader title="تقرير المعالجة" description="دفعات المعالجة خلال الفترة." />
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
          <ErrorState title="تعذر تحميل تقرير المعالجة" onRetry={() => void query.refetch()} />
        ) : data ? (
          <Grid cols={3} gap={4}>
            <KPICard title="batches_in_process" value={data.batches_in_process} />
            <KPICard title="dresses_in_processing" value={data.dresses_in_processing} />
            <KPICard title="started_in_range" value={data.started_in_range} />
            <KPICard title="completed_in_range" value={data.completed_in_range} />
            <KPICard title="optional_extra_day_count" value={data.optional_extra_day_count} />
            <KPICard
              title="avg_duration_seconds"
              value={formatDuration(data.avg_duration_seconds)}
            />
            <KPICard title="long_running_batches" value={data.long_running_batches} />
          </Grid>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
