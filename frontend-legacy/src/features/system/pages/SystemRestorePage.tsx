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
  StatusChip,
  TextArea,
  TextInput,
  type DataPaginationState
} from '@/components/ui'
import { isAppError } from '@shared/errors'
import { usePermission } from '@/hooks/usePermission'
import type { RestoreHistoryDto } from '@/services/domainTypes'
import {
  useBackupsList,
  useExecuteRestore,
  useRestoreHistory,
  useValidateRestore
} from '../hooks'
import { RESTORE_STATUS_MAP } from '../statusMap'

interface ValidationView {
  ok?: boolean
  errors?: string[]
  warnings?: string[]
  package_checksum_sha256?: string | null
}

function unwrapValidation(raw: unknown): ValidationView | null {
  if (!raw || typeof raw !== 'object') return null
  if ('data' in raw && raw.data && typeof raw.data === 'object') {
    return raw.data as ValidationView
  }
  return raw as ValidationView
}

export default function SystemRestorePage(): React.ReactElement {
  const canRestore = usePermission('system.restore')
  const [backupId, setBackupId] = React.useState('')
  const [expectedChecksum, setExpectedChecksum] = React.useState('')
  const [confirmChecksum, setConfirmChecksum] = React.useState('')
  const [confirmRestore, setConfirmRestore] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [validation, setValidation] = React.useState<ValidationView | null>(null)
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(null)
  const [restoreOpen, setRestoreOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const historyParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sort_by: 'started_at',
      sort_dir: 'desc' as const
    }),
    [pagination]
  )

  const backupsQuery = useBackupsList(
    { offset: 0, limit: 50, sort_by: 'created_at', sort_dir: 'desc' },
    { enabled: canRestore }
  )
  const historyQuery = useRestoreHistory(historyParams, { enabled: canRestore })
  const validateMutation = useValidateRestore()
  const restoreMutation = useExecuteRestore()

  const historyColumns = React.useMemo(
    () => [
      createDataColumn<RestoreHistoryDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => <StatusChip status={row.status} map={RESTORE_STATUS_MAP} />
      }),
      createDataColumn<RestoreHistoryDto>({
        accessorKey: 'id',
        header: 'المعرّف',
        cell: ({ row }) => row.id.slice(0, 8)
      }),
      createDataColumn<RestoreHistoryDto>({
        id: 'started',
        header: 'بدء',
        cell: ({ row }) =>
          row.started_at ? new Date(row.started_at).toLocaleString('ar-IQ') : '—'
      }),
      createDataColumn<RestoreHistoryDto>({
        id: 'finished',
        header: 'انتهاء',
        cell: ({ row }) =>
          row.finished_at ? new Date(row.finished_at).toLocaleString('ar-IQ') : '—'
      })
    ],
    []
  )

  if (!canRestore) return <Navigate to="/forbidden" replace />

  const historyRows = historyQuery.data?.data ?? []
  const total = historyQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))
  const completedBackups = (backupsQuery.data?.data ?? []).filter((b) => b.status === 'COMPLETED')

  const handleValidate = async (): Promise<void> => {
    setConflictMessage(null)
    const raw = await validateMutation.mutateAsync({
      backup_id: backupId.trim() || null,
      expected_checksum: expectedChecksum.trim() || null
    })
    const parsed = unwrapValidation(raw)
    setValidation(parsed)
    if (parsed?.package_checksum_sha256 && !confirmChecksum.trim()) {
      setConfirmChecksum(parsed.package_checksum_sha256)
    }
  }

  const handleRestore = async (): Promise<void> => {
    setConflictMessage(null)
    try {
      await restoreMutation.mutateAsync({
        backup_id: backupId.trim() || null,
        confirm: true,
        confirm_checksum: confirmChecksum.trim(),
        notes: notes.trim() || null
      })
      setRestoreOpen(false)
      setValidation(null)
    } catch (error) {
      if (isAppError(error) && error.code === 'conflict') {
        setConflictMessage(error.message || 'استعادة قيد التنفيذ')
      }
      throw error
    }
  }

  const canSubmitRestore =
    confirmRestore &&
    confirmChecksum.trim().length >= 64 &&
    Boolean(backupId.trim() || validation?.package_checksum_sha256)

  return (
    <div className="space-y-8">
      {conflictMessage ? (
        <InlineMessage variant="warning">{conflictMessage}</InlineMessage>
      ) : null}

      <section className="space-y-4 rounded-md border border-border p-4">
        <h3 className="text-title text-foreground">التحقق من الحزمة</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="backup-id">معرّف النسخة</Label>
            <TextInput
              id="backup-id"
              value={backupId}
              onChange={(e) => setBackupId(e.target.value)}
              placeholder="UUID أو اختر من القائمة"
              list="backup-options"
            />
            <datalist id="backup-options">
              {completedBackups.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.filename ?? b.id}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected-checksum">checksum متوقع (اختياري)</Label>
            <TextInput
              id="expected-checksum"
              value={expectedChecksum}
              onChange={(e) => setExpectedChecksum(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          loading={validateMutation.isPending}
          onClick={() => void handleValidate()}
        >
          تحقق
        </Button>
        {validation ? (
          <div className="space-y-2 rounded-md bg-muted/30 p-3">
            <p className="text-body">
              النتيجة: {validation.ok ? 'صالحة' : 'غير صالحة'}
            </p>
            {(validation.errors ?? []).map((err) => (
              <InlineMessage key={err} variant="danger">
                {err}
              </InlineMessage>
            ))}
            {(validation.warnings ?? []).map((warn) => (
              <InlineMessage key={warn} variant="warning">
                {warn}
              </InlineMessage>
            ))}
            {validation.package_checksum_sha256 ? (
              <p className="text-caption text-muted-foreground" dir="ltr">
                checksum: {validation.package_checksum_sha256}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-md border border-border p-4">
        <h3 className="text-title text-foreground">تنفيذ الاستعادة</h3>
        <InlineMessage variant="warning">
          عملية خطرة — تستبدل قاعدة البيانات الحية. مطلوب confirm_checksum من الحزمة.
        </InlineMessage>
        <div className="space-y-2">
          <Label htmlFor="confirm-checksum">confirm_checksum (SHA-256)</Label>
          <TextInput
            id="confirm-checksum"
            value={confirmChecksum}
            onChange={(e) => setConfirmChecksum(e.target.value)}
            dir="ltr"
          />
        </div>
        <TextArea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات اختيارية…"
          rows={2}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="confirm-restore"
            checked={confirmRestore}
            onCheckedChange={(v) => setConfirmRestore(v === true)}
          />
          <Label htmlFor="confirm-restore">أؤكد تنفيذ الاستعادة</Label>
        </div>
        <Button
          type="button"
          variant="danger"
          disabled={!canSubmitRestore}
          onClick={() => setRestoreOpen(true)}
        >
          استعادة
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-title text-foreground">سجل الاستعادة</h3>
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
              empty={<EmptyState title="لا عمليات استعادة" />}
            />
          </>
        )}
      </section>

      <ConfirmationDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="تأكيد الاستعادة"
        description="سيتم استبدال قاعدة البيانات. هل أنت متأكد؟"
        tone="danger"
        loading={restoreMutation.isPending}
        onConfirm={handleRestore}
      />
    </div>
  )
}
