import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  ErrorState,
  Grid,
  KPICard,
  Page,
  PageHeader
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { ReportChrome } from '../components/ReportChrome'
import { useDashboardReport } from '../hooks'

export default function DashboardReportPage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const query = useDashboardReport(canView)

  if (!canView) return <Navigate to="/forbidden" replace />

  const data = query.data

  return (
    <Page size="lg" as="main">
      <PageHeader
        title="لوحة التشغيل"
        description={
          data
            ? `حتى ${new Date(data.as_of).toLocaleString('ar-IQ')} (${data.timezone})`
            : 'لقطة تشغيلية بدون مبالغ مالية'
        }
      />
      <ReportChrome showDateRange={false}>
        {query.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : query.isError ? (
          <ErrorState title="تعذر تحميل لوحة التشغيل" onRetry={() => void query.refetch()} />
        ) : data ? (
          <Grid cols={3} gap={4}>
            <KPICard title="إجمالي الفساتين" value={data.dresses_total} icon="Package" />
            <KPICard title="فساتين نشطة" value={data.dresses_active} icon="Package" />
            <KPICard title="تأجيرات نشطة" value={data.rentals_active} icon="Key" />
            <KPICard title="مستحق الإرجاع اليوم" value={data.rentals_due_today} icon="Clock" />
            <KPICard title="متأخرة" value={data.rentals_overdue} icon="AlertTriangle" />
            <KPICard title="حجوزات اليوم" value={data.reservations_today} icon="Calendar" />
            <KPICard title="حجوزات قادمة" value={data.reservations_upcoming} icon="Calendar" />
            <KPICard
              title="دفعات معالجة جارية"
              value={data.processing_batches_in_process}
              icon="RefreshCw"
            />
            <KPICard title="فساتين قيد المعالجة" value={data.dresses_in_processing} icon="RefreshCw" />
          </Grid>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
