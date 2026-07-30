import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  AuditTimeline,
  Button,
  ConfirmationDialog,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  EntityHeader,
  ErrorState,
  ImagePicker,
  InlineMessage,
  MediaGallery,
  MediaThumbnail,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  BusyIndicator
} from '@/components/ui'
import { usePermission, useAnyPermission } from '@/hooks/usePermission'
import type { StoredFileMeta } from '@/components/ui/business/media-types'
import { CustomerForm } from '../components/CustomerForm'
import {
  useActivateCustomer,
  useCustomer,
  useCustomerAudit,
  useCustomerMedia,
  useDeactivateCustomer,
  useDeleteCustomer,
  useUpdateCustomer,
  useUploadCustomerGallery,
  useUploadCustomerProfile
} from '../hooks'
import {
  birthDateToIso,
  emptyToNull,
  toE164,
  type CustomerFormValues
} from '../schemas'

export default function CustomerDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('customer.view')
  const canAudit = usePermission('audit.view')
  const canMediaView = useAnyPermission(['media.view', 'media.manage'])
  const canMediaUpload = useAnyPermission(['media.upload', 'media.manage'])

  const [editOpen, setEditOpen] = React.useState(false)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [profileFiles, setProfileFiles] = React.useState<FileList | null>(null)
  const [galleryFiles, setGalleryFiles] = React.useState<FileList | null>(null)

  const detailQuery = useCustomer(id)
  const mediaQuery = useCustomerMedia(canMediaView ? id : undefined)
  const auditQuery = useCustomerAudit(id, canAudit)

  const updateMutation = useUpdateCustomer(id ?? '')
  const deleteMutation = useDeleteCustomer()
  const activateMutation = useActivateCustomer()
  const deactivateMutation = useDeactivateCustomer()
  const profileUpload = useUploadCustomerProfile(id ?? '')
  const galleryUpload = useUploadCustomerGallery(id ?? '')

  if (!canView) {
    return <Navigate to="/forbidden" replace />
  }

  if (!id) {
    return <Navigate to="/customers" replace />
  }

  const customer = detailQuery.data?.data

  const profileRef = mediaQuery.data?.find((r) => r.purpose === 'profile' && r.is_primary)
    ?? mediaQuery.data?.find((r) => r.purpose === 'profile')
  const galleryRefs = (mediaQuery.data ?? []).filter((r) => r.purpose !== 'profile' || r.id !== profileRef?.id)

  const profileMeta: StoredFileMeta | undefined = profileRef
    ? {
        id: profileRef.id,
        src: profileRef.dataUrl,
        mimeType: profileRef.mimeType,
        alt: customer?.full_name
      }
    : undefined

  const galleryMeta: StoredFileMeta[] = galleryRefs.map((r) => ({
    id: r.id,
    src: r.dataUrl,
    mimeType: r.mimeType,
    fileName: r.purpose
  }))

  const requestCloseEdit = (): void => {
    if (formDirty) {
      setDiscardOpen(true)
      return
    }
    setEditOpen(false)
    setFormDirty(false)
  }

  const forceCloseEdit = (): void => {
    setDiscardOpen(false)
    setEditOpen(false)
    setFormDirty(false)
  }

  const handleUpdate = async (values: CustomerFormValues): Promise<void> => {
    await updateMutation.mutateAsync({
      full_name: values.full_name,
      phone: toE164(values.phone),
      alternative_phone: emptyToNull(values.alternative_phone)
        ? toE164(values.alternative_phone)
        : null,
      address: emptyToNull(values.address),
      national_id: emptyToNull(values.national_id),
      notes: emptyToNull(values.notes),
      gender: emptyToNull(values.gender),
      birth_date: values.clear_birth_date ? null : birthDateToIso(values.birth_date),
      clear_birth_date: values.clear_birth_date,
      is_active: values.is_active
    })
    forceCloseEdit()
  }

  const genderLabel =
    customer?.gender === 'female'
      ? 'أنثى'
      : customer?.gender === 'male'
        ? 'ذكر'
        : customer?.gender === 'other'
          ? 'آخر'
          : customer?.gender ?? '—'

  return (
    <Page size="lg" as="main">
      {detailQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detailQuery.isError || !customer ? (
        <ErrorState
          title="تعذر تحميل العميل"
          message="قد يكون السجل محذوفًا أو غير متاح"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={customer.full_name}
            description={customer.customer_number}
            status={{
              label: customer.is_active ? 'نشط' : 'غير نشط',
              tone: customer.is_active ? 'success' : 'neutral'
            }}
            leading={
              canMediaView ? (
                <MediaThumbnail
                  file={
                    profileMeta ?? {
                      id: 'placeholder',
                      alt: customer.full_name
                    }
                  }
                  size="lg"
                />
              ) : undefined
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <PermissionGuard permission="customer.update">
                  <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                    تعديل
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="customer.update">
                  {customer.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deactivateMutation.isPending}
                      onClick={() => void deactivateMutation.mutateAsync(customer.id)}
                    >
                      إلغاء التفعيل
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={activateMutation.isPending}
                      onClick={() => void activateMutation.mutateAsync(customer.id)}
                    >
                      تفعيل
                    </Button>
                  )}
                </PermissionGuard>
                <PermissionGuard permission="customer.delete">
                  <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                    حذف
                  </Button>
                </PermissionGuard>
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              {canMediaView ? (
                <section className="space-y-3">
                  <h3 className="text-title text-foreground">الوسائط</h3>
                  {canMediaUpload ? (
                    <div className="flex flex-wrap gap-6">
                      <div className="space-y-2">
                        <p className="text-caption text-muted-foreground">صورة الملف الشخصي</p>
                        <ImagePicker
                          value={profileFiles}
                          onChange={(files) => {
                            setProfileFiles(files)
                            const file = files?.item(0)
                            if (file) void profileUpload.mutateAsync(file)
                          }}
                          previewUrl={profileMeta?.src}
                          label="رفع صورة شخصية"
                          disabled={profileUpload.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-caption text-muted-foreground">معرض الصور</p>
                        <ImagePicker
                          value={galleryFiles}
                          onChange={(files) => {
                            setGalleryFiles(files)
                            const file = files?.item(0)
                            if (file) void galleryUpload.mutateAsync(file)
                          }}
                          label="إضافة للمعرض"
                          disabled={galleryUpload.isPending}
                        />
                      </div>
                    </div>
                  ) : null}
                  {galleryMeta.length > 0 ? (
                    <MediaGallery files={galleryMeta} />
                  ) : (
                    <EmptyState title="لا توجد صور في المعرض" description="أضف صورًا عبر الرفع أعلاه" />
                  )}
                </section>
              ) : (
                <InlineMessage variant="info">لا تملك صلاحية عرض الوسائط</InlineMessage>
              )}

              <section className="space-y-3">
                <h3 className="text-title text-foreground">سجل التدقيق</h3>
                {!canAudit ? (
                  <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
                ) : auditQuery.isError ? (
                  <InlineMessage variant="warning">تعذر تحميل سجل التدقيق</InlineMessage>
                ) : auditQuery.isLoading ? (
                  <BusyIndicator label="جاري التحميل…" />
                ) : (auditQuery.data?.data.length ?? 0) === 0 ? (
                  <EmptyState title="لا توجد أحداث" description="لم يُسجَّل نشاط لهذا العميل بعد" />
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
              title="معلومات العميل"
              metaItems={[
                { id: 'phone', label: 'الهاتف', value: customer.phone },
                {
                  id: 'alt_phone',
                  label: 'هاتف بديل',
                  value: customer.alternative_phone ?? '—'
                },
                { id: 'national_id', label: 'الرقم الوطني', value: customer.national_id ?? '—' },
                { id: 'gender', label: 'الجنس', value: genderLabel },
                { id: 'birth_date', label: 'تاريخ الميلاد', value: customer.birth_date ?? '—' },
                { id: 'address', label: 'العنوان', value: customer.address ?? '—' },
                { id: 'notes', label: 'ملاحظات', value: customer.notes ?? '—' }
              ]}
              createdUpdated={{
                createdAt: customer.created_at,
                updatedAt: customer.updated_at
              }}
            />
          </div>
        </div>
      )}

      <Drawer
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseEdit()
        }}
      >
        <DrawerContent side="right" size="md">
          <DrawerHeader>
            <DrawerTitle>تعديل العميل</DrawerTitle>
            <DrawerDescription>تحديث بيانات العميل</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {customer ? (
              <CustomerForm
                key={customer.id}
                mode="edit"
                initial={customer}
                submitting={updateMutation.isPending}
                onSubmit={handleUpdate}
                onCancel={requestCloseEdit}
                onDirtyChange={setFormDirty}
              />
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="تغييرات غير محفوظة"
        description="لديك تعديلات لم تُحفظ. هل تريد الإغلاق دون حفظ؟"
        confirmLabel="إغلاق"
        cancelLabel="البقاء"
        tone="danger"
        onConfirm={forceCloseEdit}
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف العميل"
        description={
          customer
            ? `هل تريد حذف «${customer.full_name}»؟ هذا حذف ناعم.`
            : null
        }
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync(id)
          setDeleteOpen(false)
          void navigate('/customers')
        }}
      />
    </Page>
  )
}
