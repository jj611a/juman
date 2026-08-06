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
            <KPICard title="إجمالي المخزون" value={data.dresses_total} icon="Package" />
            <KPICard title="متاحة + محجوزة" value={data.dresses_active} icon="Package" />
            <KPICard title="تأجيرات نشطة" value={data.rentals_active} icon="Key" />
            <KPICard title="إرجاعات اليوم" value={data.rentals_due_today} icon="Clock" />
            <KPICard title="تسليمات اليوم" value={data.reservations_today} icon="Calendar" />
            <KPICard title="محجوزة" value={data.reservations_upcoming} icon="Calendar" />
            <KPICard title="تسويات مفتوحة" value={data.open_settlements ?? 0} icon="Wallet" />
            <KPICard
              title="مستحقات (فلس)"
              value={data.outstanding_balance_fils ?? 0}
              icon="AlertTriangle"
            />
            <KPICard title="إيراد اليوم (فلس)" value={data.revenue_today_fils ?? 0} icon="Key" />
          </Grid>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
