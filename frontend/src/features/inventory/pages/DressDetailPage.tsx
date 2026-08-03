import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  AuditTimeline,
  BarcodeDisplay,
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EntityHeader,
  ErrorState,
  ImagePicker,
  CameraCapture,
  InlineMessage,
  MediaGallery,
  MediaThumbnail,
  MoneyDisplay,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/stores/authStore'
import type { StoredFileMeta } from '@/components/ui/business/media-types'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import {
  useActivateDress,
  useChangeDressStatus,
  useDeactivateDress,
  useDeleteDress,
  useDress,
  useDressAudit,
  useDressPhotos,
  useRemoveDressPhoto,
  useSetDressCover,
  useUpdateDressBarcode,
  useUploadDressPhoto
} from '../hooks'
import {
  ALLOWED_DRESS_TRANSITIONS,
  DRESS_COLOUR_LABELS,
  DRESS_STATUS_MAP
} from '../statusMap'

export default function DressDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('inventory.view')
  const canAudit = usePermission('audit.view')
  const canMediaView = useAnyPermission(['media.view', 'media.manage'])
  const canMediaUpload = useAnyPermission(['media.upload', 'media.manage'])
  const canUpdate = usePermission('inventory.update')
  /** Admin role is enforced by API; FE approximates via system.* admin perms. */
  const isLikelyAdmin = useAnyPermission([
    'system.view',
    'system.maintenance',
    'system.backup',
    'system.restore'
  ])
  const username = useAuthStore((s) => s.session.user?.username)

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [statusOpen, setStatusOpen] = React.useState(false)
  const [newStatus, setNewStatus] = React.useState('')
  const [statusReason, setStatusReason] = React.useState('')
  const [barcodeOpen, setBarcodeOpen] = React.useState(false)
  const [barcodeValue, setBarcodeValue] = React.useState('')
  const [galleryFiles, setGalleryFiles] = React.useState<FileList | null>(null)

  const detailQuery = useDress(id)
  const photosQuery = useDressPhotos(canMediaView ? id : undefined)
  const auditQuery = useDressAudit(id, canAudit)

  const deleteMutation = useDeleteDress()
  const activateMutation = useActivateDress()
  const deactivateMutation = useDeactivateDress()
  const statusMutation = useChangeDressStatus(id ?? '')
  const barcodeMutation = useUpdateDressBarcode(id ?? '')
  const uploadPhoto = useUploadDressPhoto(id ?? '')
  const setCover = useSetDressCover(id ?? '')
  const removePhoto = useRemoveDressPhoto(id ?? '')

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/inventory" replace />

  const dress = detailQuery.data?.data
  const cover = photosQuery.data?.find((p) => p.is_cover) ?? photosQuery.data?.[0]
  const coverMeta: StoredFileMeta | undefined = cover?.dataUrl
    ? {
        id: cover.id,
        src: cover.dataUrl,
        mimeType: cover.file?.mime_type,
        alt: dress?.name_ar
      }
    : undefined

  const galleryMeta: StoredFileMeta[] = (photosQuery.data ?? [])
    .filter((p) => p.dataUrl)
    .map((p) => ({
      id: p.id,
      src: p.dataUrl,
      mimeType: p.file?.mime_type,
      fileName: p.caption ?? p.file?.original_filename ?? (p.is_cover ? 'غلاف' : 'صورة')
    }))

  const transitions = dress
    ? ALLOWED_DRESS_TRANSITIONS[dress.status] ?? []
    : []

  const canEditBarcode = isLikelyAdmin || username === 'admin'

  return (
    <Page size="lg" as="main" className="animate-juman-in">
      {detailQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detailQuery.isError || !dress ? (
        <ErrorState
          title="تعذر تحميل الفستان"
          message="قد يكون السجل محذوفًا أو غير متاح"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={dress.name_ar}
            description={dress.barcode}
            status={{
              label: DRESS_STATUS_MAP[dress.status]?.label ?? dress.status,
              tone: DRESS_STATUS_MAP[dress.status]?.tone ?? 'neutral'
            }}
            leading={
              canMediaView ? (
                <MediaThumbnail
                  file={coverMeta ?? { id: 'placeholder', alt: dress.name_ar }}
                  size="lg"
                />
              ) : undefined
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <PermissionGuard permission="calendar.view">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void navigate(`/calendar/${dress.id}`)}
                  >
                    التقويم
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="inventory.update">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void navigate(`/inventory/${dress.id}/edit`)}
                  >
                    تعديل
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="inventory.update">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={transitions.length === 0}
                    onClick={() => {
                      setNewStatus(transitions[0] ?? '')
                      setStatusReason('')
                      setStatusOpen(true)
                    }}
                  >
                    تغيير الحالة
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="inventory.update">
                  {dress.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deactivateMutation.isPending}
                      onClick={() => void deactivateMutation.mutateAsync(dress.id)}
                    >
                      إلغاء التفعيل
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={activateMutation.isPending}
                      onClick={() => void activateMutation.mutateAsync(dress.id)}
                    >
                      تفعيل
                    </Button>
                  )}
                </PermissionGuard>
                <PermissionGuard permission="inventory.delete">
                  <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                    حذف
                  </Button>
                </PermissionGuard>
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-title text-foreground">الباركود</h3>
                <BarcodeDisplay
                  value={dress.barcode}
                  label="باركود الفستان"
                  title={dress.name_ar}
                  printable
                />
                {canEditBarcode ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBarcodeValue('')
                      setBarcodeOpen(true)
                    }}
                  >
                    تعيين / إعادة توليد (مسؤول)
                  </Button>
                ) : null}
              </section>

              <section className="space-y-3">
                <h3 className="text-title text-foreground">الحالة</h3>
                <StatusChip status={dress.status} map={DRESS_STATUS_MAP} />
                <p className="text-caption text-muted-foreground">
                  الحالة من الخادم فقط — لا تُخترَع انتقالات محلياً.
                </p>
              </section>

              {canMediaView ? (
                <section className="space-y-3">
                  <h3 className="text-title text-foreground">الصور</h3>
                  {canUpdate && canMediaUpload ? (
                    <div className="space-y-4">
                      <ImagePicker
                        value={galleryFiles}
                        onChange={(files) => {
                          setGalleryFiles(files)
                          const file = files?.item(0)
                          if (file) void uploadPhoto.mutateAsync(file)
                        }}
                        label="رفع صورة"
                        disabled={uploadPhoto.isPending}
                      />
                      <CameraCapture
                        disabled={uploadPhoto.isPending}
                        onCapture={(file) => void uploadPhoto.mutateAsync(file)}
                      />
                    </div>
                  ) : null}
                  {galleryMeta.length > 0 ? (
                    <>
                      <MediaGallery files={galleryMeta} />
                      {canUpdate ? (
                        <ul className="space-y-2">
                          {(photosQuery.data ?? []).map((p) => (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center gap-2 text-caption"
                            >
                              <span className="text-muted-foreground">
                                {p.is_cover ? 'غلاف · ' : ''}
                                {p.file?.original_filename ?? p.id.slice(0, 8)}
                              </span>
                              {!p.is_cover ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={setCover.isPending}
                                  onClick={() => void setCover.mutateAsync(p.id)}
                                >
                                  تعيين غلاف
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                disabled={removePhoto.isPending}
                                onClick={() => void removePhoto.mutateAsync(p.id)}
                              >
                                حذف
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <EmptyState title="لا توجد صور" description="ارفع صوراً عبر الرفع أعلاه" />
                  )}
                </section>
              ) : (
                <InlineMessage variant="info">لا تملك صلاحية عرض الوسائط</InlineMessage>
              )}

              <AvailabilityPanel dressId={dress.id} />

              <section className="space-y-3">
                <h3 className="text-title text-foreground">سجل التدقيق</h3>
                {!canAudit ? (
                  <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
                ) : auditQuery.isError ? (
                  <InlineMessage variant="warning">تعذر تحميل سجل التدقيق</InlineMessage>
                ) : auditQuery.isLoading ? (
                  <BusyIndicator label="جاري التحميل…" />
                ) : (auditQuery.data?.data.length ?? 0) === 0 ? (
                  <EmptyState title="لا توجد أحداث" description="لم يُسجَّل نشاط لهذا الفستان بعد" />
                ) : (
                  <AuditTimeline
                    items={(auditQuery.data?.data ?? []).map((row) => ({
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
              title="معلومات الفستان"
              metaItems={[
                { id: 'barcode', label: 'الباركود', value: dress.barcode },
                {
                  id: 'name_en',
                  label: 'الاسم EN',
                  value: dress.name_en ?? '—'
                },
                { id: 'brand', label: 'العلامة', value: dress.brand ?? '—' },
                { id: 'size', label: 'المقاس', value: dress.size },
                {
                  id: 'colour',
                  label: 'اللون',
                  value: DRESS_COLOUR_LABELS[dress.colour] ?? dress.colour
                },
                {
                  id: 'purchase_price',
                  label: 'سعر الشراء',
                  value: <MoneyDisplay value={dress.purchase_price} />
                },
                {
                  id: 'rental',
                  label: 'إيجار يومي',
                  value: <MoneyDisplay value={dress.default_daily_rental_price} />
                },
                {
                  id: 'sale',
                  label: 'سعر البيع',
                  value: <MoneyDisplay value={dress.default_sale_price} />
                },
                {
                  id: 'purchase_date',
                  label: 'تاريخ الشراء',
                  value: dress.purchase_date ?? '—'
                },
                {
                  id: 'active',
                  label: 'التفعيل',
                  value: dress.is_active ? 'نشط' : 'غير نشط'
                },
                {
                  id: 'description',
                  label: 'الوصف',
                  value: dress.description ?? '—'
                }
              ]}
              createdUpdated={{
                createdAt: dress.created_at,
                updatedAt: dress.updated_at
              }}
            />
          </div>
        </div>
      )}

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير الحالة</DialogTitle>
            <DialogDescription>
              الانتقال عبر محرك الحالة في الخادم فقط.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة الجديدة" />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {DRESS_STATUS_MAP[code]?.label ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TextInput
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="سبب (اختياري)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={!newStatus || statusMutation.isPending}
              onClick={async () => {
                await statusMutation.mutateAsync({
                  new_status: newStatus,
                  reason: statusReason.trim() || null
                })
                setStatusOpen(false)
              }}
            >
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحديث الباركود</DialogTitle>
            <DialogDescription>
              اترك الحقل فارغاً لإعادة التوليد التلقائي. يتطلب دور المسؤول.
            </DialogDescription>
          </DialogHeader>
          <TextInput
            dir="ltr"
            value={barcodeValue}
            onChange={(e) => setBarcodeValue(e.target.value)}
            placeholder="باركود جديد أو فارغ للتوليد"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBarcodeOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={barcodeMutation.isPending}
              onClick={async () => {
                await barcodeMutation.mutateAsync(
                  barcodeValue.trim() ? barcodeValue.trim() : null
                )
                setBarcodeOpen(false)
              }}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف الفستان؟"
        description="سيتم الحذف الناعم للفستان. لا يمكن التراجع من الواجهة."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        tone="danger"
        onConfirm={async () => {
          await deleteMutation.mutateAsync(id)
          setDeleteOpen(false)
          void navigate('/inventory')
        }}
      />
    </Page>
  )
}
