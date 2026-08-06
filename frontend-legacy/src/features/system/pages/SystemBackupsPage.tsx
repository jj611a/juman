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
  Label,
  PageActions,
  PermissionGuard,
  StatusChip,
  TextArea,
  type DataPaginationState,
  type DataRowAction
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import type { SystemBackupDto } from '@/services/domainTypes'
import { formatBytes } from '../api'
import {
  useBackupsList,
  useCreateBackup,
  useDeleteBackup,
  useDownloadBackup
} from '../hooks'
import { BACKUP_STATUS_MAP } from '../statusMap'

export default function SystemBackupsPage(): React.ReactElement {
  const canBackup = usePermission('system.backup')
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [includeMedia, setIncludeMedia] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<SystemBackupDto | null>(null)

  const params = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'created_at',
      sort_dir: 'desc' as const
    }),
    [pagination]
  )

  const listQuery = useBackupsList(params, { enabled: canBackup })
  const createMutation = useCreateBackup()
  const deleteMutation = useDeleteBackup()
  const downloadMutation = useDownloadBackup()

  const columns = React.useMemo(
    () => [
      createDataColumn<SystemBackupDto>({
        accessorKey: 'filename',
        header: 'الملف',
        cell: ({ row }) => row.filename ?? row.id.slice(0, 8)
      }),
      createDataColumn<SystemBackupDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => <StatusChip status={row.status} map={BACKUP_STATUS_MAP} />
      }),
      createDataColumn<SystemBackupDto>({
        id: 'size',
        header: 'الحجم',
        cell: ({ row }) => formatBytes(row.compressed_size_bytes)
      }),
      createDataColumn<SystemBackupDto>({
        accessorKey: 'created_at',
        header: 'التاريخ',
        cell: ({ row }) => new Date(row.created_at).toLocaleString('ar-IQ')
      })
    ],
    []
  )

  const actions = React.useMemo<DataRowAction<SystemBackupDto>[]>(
    () => [
      {
        id: 'download',
        label: 'تنزيل',
        icon: 'Download',
        permission: 'system.backup',
        onClick: (row) => void downloadMutation.mutateAsync(row.id)
      },
      {
        id: 'delete',
        label: 'حذف',
        icon: 'Trash2',
        tone: 'danger',
        permission: 'system.backup',
        onClick: (row) => setDeleteTarget(row)
      }
    ],
    [downloadMutation]
  )

  if (!canBackup) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  return (
    <div className="space-y-6">
      <PermissionGuard permission="system.backup">
        <section className="space-y-4 rounded-md border border-border p-4">
          <h3 className="text-title text-foreground">إنشاء نسخة احتياطية</h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-media"
              checked={includeMedia}
              onCheckedChange={(v) => setIncludeMedia(v === true)}
            />
            <Label htmlFor="include-media">تضمين الوسائط</Label>
          </div>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات اختيارية…"
            rows={2}
          />
          <PageActions>
            <Button
              type="button"
              loading={createMutation.isPending}
              onClick={() =>
                void createMutation.mutateAsync({
                  include_media: includeMedia,
                  notes: notes.trim() || null
                })
              }
            >
              إنشاء نسخة
            </Button>
          </PageActions>
        </section>
      </PermissionGuard>

      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل النسخ" onRetry={() => void listQuery.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            manual
            loading={listQuery.isLoading || listQuery.isFetching}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            totalItems={total}
            actions={actions}
            empty={<EmptyState title="لا نسخ احتياطية" />}
          />
        </>
      )}

      <ConfirmationDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="حذف النسخة؟"
        description={deleteTarget?.filename ?? deleteTarget?.id}
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
