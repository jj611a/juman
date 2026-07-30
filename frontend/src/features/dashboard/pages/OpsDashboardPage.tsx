import * as React from 'react'
import { Page } from '@/components/ui'
import { DashboardHeader } from '../components/DashboardHeader'

const DashboardKpis = React.lazy(() =>
  import('../components/DashboardKpis').then((m) => ({ default: m.DashboardKpis }))
)
const DashboardTodayWork = React.lazy(() =>
  import('../components/DashboardTodayWork').then((m) => ({ default: m.DashboardTodayWork }))
)
const DashboardQuickActions = React.lazy(() =>
  import('../components/DashboardQuickActions').then((m) => ({ default: m.DashboardQuickActions }))
)
const DashboardRecentActivity = React.lazy(() =>
  import('../components/DashboardRecentActivity').then((m) => ({ default: m.DashboardRecentActivity }))
)
const DashboardSystemStatus = React.lazy(() =>
  import('../components/DashboardSystemStatus').then((m) => ({ default: m.DashboardSystemStatus }))
)

function SectionFallback(): React.ReactElement {
  return <div className="text-caption text-muted-foreground">جاري التحميل…</div>
}

export default function OpsDashboardPage(): React.ReactElement {
  return (
    <Page size="full" as="main" className="space-y-6">
      <DashboardHeader />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardKpis />
          </React.Suspense>
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardTodayWork />
          </React.Suspense>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardQuickActions />
          </React.Suspense>
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardRecentActivity />
          </React.Suspense>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardSystemStatus />
          </React.Suspense>
        </div>
      </div>
    </Page>
  )
}
