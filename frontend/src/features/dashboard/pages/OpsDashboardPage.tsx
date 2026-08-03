import * as React from 'react'
import { Page, SkeletonCard } from '@/components/ui'
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
  return <SkeletonCard className="min-h-40" />
}

export default function OpsDashboardPage(): React.ReactElement {
  return (
    <Page size="full" as="main" className="space-y-8 animate-juman-in">
      <DashboardHeader />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardKpis />
          </React.Suspense>
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardTodayWork />
          </React.Suspense>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardQuickActions />
          </React.Suspense>
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardRecentActivity />
          </React.Suspense>
        </div>

        <div className="space-y-6 xl:col-span-3">
          <React.Suspense fallback={<SectionFallback />}>
            <DashboardSystemStatus />
          </React.Suspense>
        </div>
      </div>
    </Page>
  )
}
