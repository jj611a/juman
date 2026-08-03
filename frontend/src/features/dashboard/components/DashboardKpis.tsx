import * as React from 'react'
import { BusyIndicator, ErrorState, Grid, InlineMessage, KPICard } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useDashboardReport } from '@/features/reports/hooks'
import type { DashboardReportDto } from '@/services/domainTypes'

function kpiItems(data: DashboardReportDto): Array<{ title: string; value: number; icon: 'Key' | 'Calendar' | 'Clock' | 'AlertTriangle' | 'Package' | 'Wallet' }> {
  const items: Array<{ title: string; value: number; icon: 'Key' | 'Calendar' | 'Clock' | 'AlertTriangle' | 'Package' | 'Wallet' }> = [
    { title: 'تأجيرات نشطة', value: data.rentals_active, icon: 'Key' },
    { title: 'تسليمات اليوم', value: data.reservations_today, icon: 'Calendar' },
    { title: 'إرجاعات اليوم', value: data.rentals_due_today, icon: 'Clock' },
    { title: 'عناصر المخزون', value: data.dresses_total, icon: 'Package' },
    { title: 'محجوزة', value: data.reservations_upcoming, icon: 'Calendar' },
    { title: 'تسويات مفتوحة', value: data.open_settlements ?? 0, icon: 'Wallet' }
  ]
  if (Object.prototype.hasOwnProperty.call(data.dresses_by_status ?? {}, 'AVAILABLE')) {
    items.splice(3, 0, {
      title: 'متاحة',
      value: data.dresses_by_status.AVAILABLE,
      icon: 'Package'
    })
  }
  return items
}

export function DashboardKpis(): React.ReactElement {
  const canView = usePermission('reports.view')
  const query = useDashboardReport(canView)

  if (!canView) {
    return (
      <section aria-labelledby="dash-kpi-heading" className="space-y-3">
        <h2 id="dash-kpi-heading" className="text-title text-foreground">
          المؤشرات
        </h2>
        <InlineMessage variant="info">لا تملك صلاحية عرض التقارير</InlineMessage>
      </section>
    )
  }

  return (
    <section aria-labelledby="dash-kpi-heading" className="space-y-3">
      <h2 id="dash-kpi-heading" className="text-title text-foreground">
        المؤشرات
      </h2>
      {query.isLoading ? <BusyIndicator label="جاري التحميل…" /> : null}
      {query.isError ? (
        <ErrorState title="تعذر تحميل المؤشرات" message="تحقق من الاتصال ثم أعد المحاولة" onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <Grid cols={2} gap={3} className="lg:grid-cols-2">
          {kpiItems(query.data).map((item) => (
            <KPICard key={item.title} title={item.title} value={item.value} icon={item.icon} />
          ))}
        </Grid>
      ) : null}
    </section>
  )
}
