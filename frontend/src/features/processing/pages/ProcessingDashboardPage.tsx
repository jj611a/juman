import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import {
  Button,
  EmptyState,
  ErrorState,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  mapStatus,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { useReturnsList } from '@/features/returns/hooks'
import { useInspectionsList, useProcessingList } from '../hooks'
import { INSPECTION_STATUS_MAP, PROCESSING_STATUS_MAP } from '../statusMap'
import type { InspectionDto, ProcessingBatchDto, ReturnDto } from '@/services/domainTypes'

export default function ProcessingDashboardPage(): React.ReactElement {
  const canAccess = useAnyPermission(['processing.view', 'inspection.view'])
  const navigate = useNavigate()

  const pendingReturns = useReturnsList({ status: 'PENDING_INSPECTION', limit: 20, offset: 0 })
  const pendingInspections = useInspectionsList({ status: 'PENDING', limit: 20, offset: 0 })
  const pendingBatches = useProcessingList({ status: 'PENDING', limit: 20, offset: 0 })
  const inProcessBatches = useProcessingList({ status: 'IN_PROCESS', limit: 20, offset: 0 })
  const completedBatches = useProcessingList({ status: 'COMPLETED', limit: 20, offset: 0 })

  if (!canAccess) return <Navigate to="/forbidden" replace />

  const processingRows: ProcessingBatchDto[] = [
    ...(pendingBatches.data?.data ?? []),
    ...(inProcessBatches.data?.data ?? [])
  ]

  return (
    <Page size="full" as="main">
      <PageHeader
        title="المعالجة"
        description="لوحة الفحص والمعالجة والفساتين الجاهزة"
        actions={
          <PageActions>
            <PermissionGuard permission="inspection.view">
              <Button type="button" variant="outline" asChild>
                <Link to="/processing/inspections">كل الفحوصات</Link>
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="processing.view">
              <Button type="button" variant="outline" asChild>
                <Link to="/processing/batches">كل الدفعات</Link>
              </Button>
            </PermissionGuard>
          </PageActions>
        }
      />

      <Tabs defaultValue="inspection">
        <TabsList>
          <TabsTrigger value="inspection">فحص</TabsTrigger>
          <TabsTrigger value="processing">معالجة</TabsTrigger>
          <TabsTrigger value="ready">جاهز</TabsTrigger>
        </TabsList>

        <TabsContent value="inspection" className="mt-6 space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-title text-foreground">مرتجعات بانتظار الفحص</h3>
              <PermissionGuard permission="inspection.create">
                <Button type="button" size="sm" onClick={() => void navigate('/processing/inspections/new')}>
                  فحص جديد
                </Button>
              </PermissionGuard>
            </div>
            {pendingReturns.isLoading ? (
              <BusyIndicator label="جاري التحميل…" />
            ) : pendingReturns.isError ? (
              <ErrorState title="تعذر تحميل المرتجعات" onRetry={() => void pendingReturns.refetch()} />
            ) : (pendingReturns.data?.data.length ?? 0) === 0 ? (
              <EmptyState title="لا مرتجعات بانتظار الفحص" />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {(pendingReturns.data?.data ?? []).map((row: ReturnDto) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="font-medium">{row.return_number}</p>
                      <p className="text-caption text-muted-foreground">
                        {new Date(row.returned_at).toLocaleString('ar-IQ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void navigate(`/returns/${row.id}`)}
                      >
                        المرتجع
                      </Button>
                      <PermissionGuard permission="inspection.create">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            void navigate(`/processing/inspections/new?returnId=${row.id}`)
                          }
                        >
                          بدء فحص
                        </Button>
                      </PermissionGuard>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-title text-foreground">فحوصات قيد التنفيذ</h3>
            {pendingInspections.isLoading ? (
              <BusyIndicator label="جاري التحميل…" />
            ) : pendingInspections.isError ? (
              <ErrorState title="تعذر تحميل الفحوصات" onRetry={() => void pendingInspections.refetch()} />
            ) : (pendingInspections.data?.data.length ?? 0) === 0 ? (
              <EmptyState title="لا فحوصات معلقة" />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {(pendingInspections.data?.data ?? []).map((row: InspectionDto) => {
                  const mapped = mapStatus(String(row.status), INSPECTION_STATUS_MAP)
                  return (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <p className="font-medium">{row.inspection_number}</p>
                        <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void navigate(`/processing/inspections/${row.id}`)}
                      >
                        متابعة الفحص
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="processing" className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-title text-foreground">دفعات قيد الانتظار أو المعالجة</h3>
            <PermissionGuard permission="processing.create">
              <Button type="button" size="sm" onClick={() => void navigate('/processing/batches/new')}>
                دفعة جديدة
              </Button>
            </PermissionGuard>
          </div>
          {pendingBatches.isLoading || inProcessBatches.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : pendingBatches.isError || inProcessBatches.isError ? (
            <ErrorState
              title="تعذر تحميل الدفعات"
              onRetry={() => {
                void pendingBatches.refetch()
                void inProcessBatches.refetch()
              }}
            />
          ) : processingRows.length === 0 ? (
            <EmptyState title="لا دفعات نشطة" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {processingRows.map((row) => {
                const mapped = mapStatus(String(row.status), PROCESSING_STATUS_MAP)
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="font-medium">{row.processing_number}</p>
                      <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void navigate(`/processing/batches/${row.id}`)}
                    >
                      عرض الدفعة
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="ready" className="mt-6 space-y-3">
          <h3 className="text-title text-foreground">فساتين جاهزة للإعارة</h3>
          {completedBatches.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : completedBatches.isError ? (
            <ErrorState title="تعذر تحميل الدفعات" onRetry={() => void completedBatches.refetch()} />
          ) : (completedBatches.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="لا فساتين جاهزة" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(completedBatches.data?.data ?? []).map((row) => {
                const mapped = mapStatus(String(row.status), PROCESSING_STATUS_MAP)
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="font-medium">{row.processing_number}</p>
                      <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
                      {row.completed_at ? (
                        <p className="text-caption text-muted-foreground">
                          {new Date(row.completed_at).toLocaleString('ar-IQ')}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void navigate(`/processing/batches/${row.id}`)}
                    >
                      عرض الدفعة
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  )
}
