import * as React from 'react'
import { Navigate } from 'react-router'
import {
  Button,
  Checkbox,
  ConfirmationDialog,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  InlineMessage,
  Label,
  PermissionGuard,
  StatusChip,
  type DataPaginationState
} from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import type { MaintenanceRunDto, MaintenanceTaskDto } from '@/services/domainTypes'
import { taskKeyOf, taskTitleOf } from '../api'
import { useExecuteMaintenance, useMaintenanceHistory, useMaintenanceTasks } from '../hooks'
import { MAINTENANCE_RUN_STATUS_MAP } from '../statusMap'

export default function SystemMaintenancePage(): React.ReactElement {
  const canViewTasks = useAnyPermission(['system.view', 'system.maintenance'])
  const canExecute = usePermission('system.maintenance')
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [executeTarget, setExecuteTarget] = React.useState<MaintenanceTaskDto | null>(null)
  const [confirmExecute, setConfirmExecute] = React.useState(false)
  const [dryRun, setDryRun] = React.useState(false)

  const historyParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'started_at',
      sort_dir: 'desc' as const
    }),
    [pagination]
  )

  const tasksQuery = useMaintenanceTasks({ enabled: canViewTasks })
  const historyQuery = useMaintenanceHistory(historyParams, { enabled: canViewTasks })
  const executeMutation = useExecuteMaintenance()

  const historyColumns = React.useMemo(
    () => [
      createDataColumn<MaintenanceRunDto>({
        accessorKey: 'task_key',
        header: 'المهمة'
      }),
      createDataColumn<MaintenanceRunDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => <StatusChip status={row.status} map={MAINTENANCE_RUN_STATUS_MAP} />
      }),
      createDataColumn<MaintenanceRunDto>({
        id: 'started',
        header: 'بدء',
        cell: ({ row }) =>
          row.started_at ? new Date(String(row.started_at)).toLocaleString('ar-IQ') : '—'
      }),
      createDataColumn<MaintenanceRunDto>({
        id: 'finished',
        header: 'انتهاء',
        cell: ({ row }) =>
          row.finished_at ? new Date(String(row.finished_at)).toLocaleString('ar-IQ') : '—'
      })
    ],
    []
  )

  if (!canViewTasks) return <Navigate to="/forbidden" replace />

  const tasks = tasksQuery.data ?? []
  const historyRows = historyQuery.data?.data ?? []
  const total = historyQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  const requiresConfirmation = Boolean(
    executeTarget &&
      (executeTarget.requires_confirmation === true ||
        (executeTarget as { requiresConfirmation?: boolean }).requiresConfirmation)
  )

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-title text-foreground">مهام الصيانة</h3>
        {tasksQuery.isError ? (
          <ErrorState title="تعذر تحميل المهام" onRetry={() => void tasksQuery.refetch()} />
        ) : tasksQuery.isLoading ? (
          <p className="text-caption text-muted-foreground">جاري التحميل…</p>
        ) : tasks.length === 0 ? (
          <EmptyState title="لا مهام" />
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                key={taskKeyOf(task)}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-4"
              >
                <div className="space-y-1">
                  <p className="text-body font-medium">{taskTitleOf(task)}</p>
                  <p className="text-caption text-muted-foreground">
                    {String(task.description ?? '')}
                  </p>
                  <p className="text-caption text-muted-foreground" dir="ltr">
                    {taskKeyOf(task)}
                  </p>
                </div>
                <PermissionGuard permission="system.maintenance">
                  <Button type="button" size="sm" onClick={() => setExecuteTarget(task)}>
                    تنفيذ
                  </Button>
                </PermissionGuard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-title text-foreground">سجل التنفيذ</h3>
        {historyQuery.isError ? (
          <ErrorState title="تعذر تحميل السجل" onRetry={() => void historyQuery.refetch()} />
        ) : (
          <>
            <DataTable
              columns={historyColumns}
              data={historyRows}
              getRowId={(r) => r.id}
              manual
              loading={historyQuery.isLoading || historyQuery.isFetching}
              pagination={pagination}
              onPaginationChange={setPagination}
              pageCount={pageCount}
              totalItems={total}
              empty={<EmptyState title="لا سجل" />}
            />
          </>
        )}
      </section>

      <ConfirmationDialog
        open={executeTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setExecuteTarget(null)
            setConfirmExecute(false)
            setDryRun(false)
          }
        }}
        title={`تنفيذ: ${executeTarget ? taskTitleOf(executeTarget) : ''}`}
        description={
          <div className="space-y-3">
            {requiresConfirmation ? (
              <InlineMessage variant="warning">هذه المهمة تتطلب تأكيداً صريحاً.</InlineMessage>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id="dry-run"
                checked={dryRun}
                onCheckedChange={(v) => setDryRun(v === true)}
              />
              <Label htmlFor="dry-run">dry_run (تجربة دون تطبيق)</Label>
            </div>
            {requiresConfirmation ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirm-execute"
                  checked={confirmExecute}
                  onCheckedChange={(v) => setConfirmExecute(v === true)}
                />
                <Label htmlFor="confirm-execute">أؤكد التنفيذ</Label>
              </div>
            ) : null}
          </div>
        }
        tone="danger"
        loading={executeMutation.isPending}
        onConfirm={async () => {
          if (!executeTarget || !canExecute) return
          if (requiresConfirmation && !confirmExecute) return
          await executeMutation.mutateAsync({
            taskKey: taskKeyOf(executeTarget),
            body: { confirm: requiresConfirmation ? true : confirmExecute, dry_run: dryRun }
          })
          setExecuteTarget(null)
          setConfirmExecute(false)
          setDryRun(false)
        }}
      />
    </div>
  )
}
