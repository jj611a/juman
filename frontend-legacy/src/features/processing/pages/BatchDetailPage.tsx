import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AuditTimeline,
  Button,
  Checkbox,
  EmptyState,
  EntityHeader,
  ErrorState,
  InlineMessage,
  Label,
  MediaGallery,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  StatusChip,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import type { StoredFileMeta } from '@/components/ui/business/media-types'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { useDressPhotos } from '@/features/inventory/hooks'
import { apiClient } from '@/services/apiClient'
import {
  useAddProcessingOptionalDay,
  useCompleteProcessingBatch,
  useProcessingAudit,
  useProcessingBatch,
  useStartProcessingBatch,
  useUpdateProcessingBatch
} from '../hooks'
import { PROCESSING_STATUS_MAP } from '../statusMap'

function DressPhotosSection({ dressId }: { dressId: string }): React.ReactElement {
  const canMediaView = useAnyPermission(['media.view', 'media.manage'])
  const photosQuery = useDressPhotos(canMediaView ? dressId : undefined)

  if (!canMediaView) return <InlineMessage variant="info">لا تملك صلاحية عرض الوسائط</InlineMessage>
  if (photosQuery.isLoading) return <BusyIndicator label="جاري تحميل الصور…" />
  if (photosQuery.isError) return <InlineMessage variant="warning">تعذر تحميل الصور</InlineMessage>

  const galleryMeta: StoredFileMeta[] = (photosQuery.data ?? [])
    .filter((p) => p.dataUrl)
    .map((p) => ({
      id: p.id,
      src: p.dataUrl,
      mimeType: p.file?.mime_type,
      fileName: p.caption ?? p.file?.original_filename ?? (p.is_cover ? 'غلاف' : 'صورة')
    }))

  if (galleryMeta.length === 0) return <EmptyState title="لا صور" />

  return <MediaGallery files={galleryMeta} />
}

export default function BatchDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('processing.view')
  const canCreate = usePermission('processing.create')
  const canUpdate = usePermission('processing.update')
  const canComplete = usePermission('processing.complete')
  const canAudit = usePermission('audit.view')

  const detail = useProcessingBatch(id)
  const audit = useProcessingAudit(id, canAudit)
  const startMutation = useStartProcessingBatch(id ?? '')
  const addDayMutation = useAddProcessingOptionalDay(id ?? '')
  const completeMutation = useCompleteProcessingBatch(id ?? '')
  const updateMutation = useUpdateProcessingBatch(id ?? '')

  const batch = detail.data?.data
  const isPending = batch?.status === 'PENDING'
  const isInProcess = batch?.status === 'IN_PROCESS'
  const isCompleted = batch?.status === 'COMPLETED'

  const [notes, setNotes] = React.useState('')
  const [editingNotes, setEditingNotes] = React.useState(false)
  const [startEnableOptionalDay, setStartEnableOptionalDay] = React.useState(false)

  React.useEffect(() => {
    if (batch) setNotes(batch.notes ?? '')
  }, [batch])

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { limit: 200 }],
    queryFn: () => apiClient.dresses.list({ page: 1, page_size: 200 }),
    enabled: Boolean(batch)
  })
  const dressName = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const d of dresses.data?.data ?? []) m.set(d.id, d.name_ar)
    return m
  }, [dresses.data])

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/processing/batches" replace />

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !batch ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={batch.processing_number}
            status={{
              label: PROCESSING_STATUS_MAP[batch.status]?.label ?? batch.status,
              tone: PROCESSING_STATUS_MAP[batch.status]?.tone ?? 'neutral'
            }}
            actions={
              <div className="flex flex-wrap gap-2">
                {isPending && canCreate ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="start-optional-day"
                        checked={startEnableOptionalDay}
                        onCheckedChange={(v) => setStartEnableOptionalDay(v === true)}
                      />
                      <Label htmlFor="start-optional-day">تفعيل اليوم الاختياري</Label>
                    </div>
                    <Button
                      type="button"
                      disabled={startMutation.isPending}
                      onClick={() =>
                        void startMutation.mutateAsync({
                          enable_optional_day: startEnableOptionalDay ? true : null
                        })
                      }
                    >
                      بدء المعالجة
                    </Button>
                  </div>
                ) : null}
                {isInProcess && canUpdate && batch.optional_extra_day_enabled === false ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={addDayMutation.isPending}
                    onClick={() => void addDayMutation.mutateAsync()}
                  >
                    إضافة يوم اختياري
                  </Button>
                ) : null}
                {isInProcess && canComplete ? (
                  <Button
                    type="button"
                    disabled={completeMutation.isPending}
                    onClick={() => void completeMutation.mutateAsync()}
                  >
                    إكمال المعالجة
                  </Button>
                ) : null}
              </div>
            }
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">بدء المعالجة</p>
              <p>{batch.started_at ? new Date(batch.started_at).toLocaleString('ar-IQ') : '—'}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">نهاية المعالجة الإلزامية</p>
              <p>
                {batch.mandatory_processing_end_at
                  ? new Date(batch.mandatory_processing_end_at).toLocaleString('ar-IQ')
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-caption text-muted-foreground">نهاية المعالجة النهائية</p>
              <p>
                {batch.final_processing_end_at
                  ? new Date(batch.final_processing_end_at).toLocaleString('ar-IQ')
                  : '—'}
              </p>
            </div>
          </div>

          <section className="space-y-4">
            <h3 className="text-title text-foreground">البنود</h3>
            {(batch.items?.length ?? 0) === 0 ? (
              <EmptyState title="لا بنود" />
            ) : (
              <ul className="space-y-6">
                {batch.items.map((item) => (
                  <li key={item.id} className="rounded-md border border-border p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{dressName.get(item.dress_id) ?? item.dress_id}</p>
                        <PermissionGuard permission="inventory.view">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void navigate(`/inventory/${item.dress_id}`)}
                          >
                            عرض الفستان
                          </Button>
                        </PermissionGuard>
                      </div>
                      <StatusChip status={item.status} map={PROCESSING_STATUS_MAP} />
                    </div>
                    <DressPhotosSection dressId={item.dress_id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">ملاحظات</h3>
                {canUpdate && !isCompleted ? (
                  editingNotes ? (
                    <div className="space-y-2">
                      <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={async () => {
                            await updateMutation.mutateAsync({
                              notes: notes.trim() || null,
                              clear_notes: !notes.trim()
                            })
                            setEditingNotes(false)
                          }}
                        >
                          حفظ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setNotes(batch.notes ?? '')
                            setEditingNotes(false)
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p>{batch.notes ?? '—'}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingNotes(true)}
                      >
                        تعديل
                      </Button>
                    </div>
                  )
                ) : (
                  <p>{batch.notes ?? '—'}</p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">سجل التدقيق</h3>
                {!canAudit ? (
                  <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
                ) : audit.isError ? (
                  <InlineMessage variant="warning">تعذر تحميل سجل التدقيق</InlineMessage>
                ) : audit.isLoading ? (
                  <BusyIndicator label="جاري التحميل…" />
                ) : (audit.data?.data.length ?? 0) === 0 ? (
                  <EmptyState title="لا أحداث" />
                ) : (
                  <AuditTimeline
                    items={(audit.data?.data ?? []).map((row) => ({
                      id: row.id,
                      at: row.created_at,
                      actor: row.username ?? undefined,
                      action: row.action,
                      detail: row.message ?? undefined
                    }))}
                  />
                )}
              </section>
            </div>

            <RecordInfoPanel
              title="معلومات الدفعة"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={batch.status} map={PROCESSING_STATUS_MAP} />
                },
                {
                  id: 'optional_day',
                  label: 'اليوم الاختياري',
                  value: batch.optional_extra_day_enabled ? 'مفعّل' : 'غير مفعّل'
                },
                {
                  id: 'completed_at',
                  label: 'تاريخ الإكمال',
                  value: batch.completed_at
                    ? new Date(batch.completed_at).toLocaleString('ar-IQ')
                    : '—'
                }
              ]}
              createdUpdated={{
                createdAt: batch.created_at,
                updatedAt: batch.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
