import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  Button,
  BusyIndicator,
  EmptyState,
  ErrorState,
  InlineMessage,
  Page,
  PageHeader,
  PermissionGuard
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useDress } from '@/features/inventory/hooks'
import type { CalendarBlockDto } from '@/services/domainTypes'
import { AvailabilityPanel } from '@/features/inventory/components/AvailabilityPanel'
import { BlockDetailDrawer } from '../components/BlockDetailDrawer'
import { DressTimelineGrid } from '../components/DressTimelineGrid'
import { MaintenanceBlockForm } from '../components/MaintenanceBlockForm'
import {
  formatRangeLabel,
  shiftAnchor,
  toIso,
  visibleRange,
  type CalendarViewMode
} from '../dateRange'
import { useDressTimeline } from '../hooks'

export default function CalendarDressPage(): React.ReactElement {
  const { dressId } = useParams<{ dressId: string }>()
  const canView = usePermission('calendar.view')
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<CalendarViewMode>('month')
  const [anchor, setAnchor] = React.useState(() => new Date())
  const [selected, setSelected] = React.useState<CalendarBlockDto | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const dressQuery = useDress(dressId)
  const range = React.useMemo(() => visibleRange(anchor, mode), [anchor, mode])
  const fromIso = toIso(range.from)
  const toIsoStr = toIso(range.to)

  const timeline = useDressTimeline(dressId, fromIso, toIsoStr)

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!dressId) return <Navigate to="/calendar" replace />

  const dress = dressQuery.data?.data
  const blocks = timeline.data?.data ?? []

  return (
    <Page size="full" as="main">
      <PageHeader
        title={dress ? `تقويم · ${dress.name_ar}` : 'تقويم الفستان'}
        description={dress?.barcode}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void navigate('/calendar')}>
              اختيار فستان آخر
            </Button>
            <PermissionGuard permission="inventory.view">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigate(`/inventory/${dressId}`)}
              >
                المخزون
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      {dressQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : dressQuery.isError || !dress ? (
        <ErrorState
          title="تعذر تحميل الفستان"
          message="تحقق من الرابط أو الصلاحيات"
          onRetry={() => void dressQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['month', 'week', 'day'] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={mode === m ? 'primary' : 'outline'}
                  onClick={() => setMode(m)}
                >
                  {m === 'month' ? 'شهر' : m === 'week' ? 'أسبوع' : 'يوم'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAnchor((a) => shiftAnchor(a, mode, -1))}
              >
                السابق
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAnchor(new Date())}>
                اليوم
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAnchor((a) => shiftAnchor(a, mode, 1))}
              >
                التالي
              </Button>
              <span className="text-body text-foreground">{formatRangeLabel(anchor, mode)}</span>
            </div>
          </div>

          <InlineMessage variant="info">
            النافذة الزمنية تُحسب في الواجهة؛ الكتل تُجلب من واجهة التقويم للخادم فقط.
          </InlineMessage>

          {timeline.isLoading ? (
            <BusyIndicator label="جاري تحميل الجدول…" />
          ) : timeline.isError ? (
            <ErrorState
              title="تعذر تحميل الجدول"
              message="تحقق من الاتصال أو الصلاحيات"
              onRetry={() => void timeline.refetch()}
            />
          ) : blocks.length === 0 ? (
            <EmptyState title="لا كتل في هذه الفترة" description="الفترة فارغة حسب الخادم" />
          ) : null}

          {!timeline.isLoading && !timeline.isError ? (
            <DressTimelineGrid
              mode={mode}
              from={range.from}
              to={range.to}
              blocks={blocks}
              onBlockClick={(b) => {
                setSelected(b)
                setDrawerOpen(true)
              }}
            />
          ) : null}

          <PermissionGuard permission="calendar.manage">
            <MaintenanceBlockForm dressId={dressId} />
          </PermissionGuard>

          <AvailabilityPanel dressId={dressId} />
        </div>
      )}

      <BlockDetailDrawer
        block={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Page>
  )
}
