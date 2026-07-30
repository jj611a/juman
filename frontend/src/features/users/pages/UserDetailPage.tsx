import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  Button,
  ConfirmationDialog,
  createDataColumn,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  EntityHeader,
  ErrorState,
  InlineMessage,
  Page,
  PasswordInput,
  PermissionGuard,
  RecordInfoPanel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  TextInput,
  mapStatus,
  BusyIndicator,
  type DataPaginationState
} from '@/components/ui'
import { useRolesList } from '@/features/roles/hooks'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'
import type { LoginHistoryDto } from '@/services/domainTypes'
import {
  useActivateUser,
  useDeactivateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUser,
  useUserLoginHistory
} from '../hooks'
import {
  USER_ACTIVE_STATUS_MAP,
  USER_LOCKED_STATUS_MAP,
  userActiveKey,
  userLockedKey
} from '../statusMap'

export default function UserDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = useAnyPermission(['users.view', 'users.manage'])
  const canUpdate = useAnyPermission(['users.update', 'users.manage'])
  const canDelete = useAnyPermission(['users.delete', 'users.manage'])
  const canManage = usePermission('users.manage')
  const canLoginHistory = usePermission('users.view_login_history')

  const [editOpen, setEditOpen] = React.useState(false)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [history, setHistory] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 10
  })

  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [roleId, setRoleId] = React.useState('')

  const detailQuery = useUser(id)
  const rolesQuery = useRolesList()
  const user = detailQuery.data?.data

  React.useEffect(() => {
    if (!user) return
    setFullName(user.full_name)
    setPhone(user.phone ?? '')
    setEmail(user.email ?? '')
    setRoleId(user.role_id)
    setFormDirty(false)
  }, [user])

  const historyParams = React.useMemo(
    () => ({
      offset: history.pageIndex * history.pageSize,
      limit: history.pageSize
    }),
    [history]
  )

  const loginHistoryQuery = useUserLoginHistory(id, historyParams, canLoginHistory)

  const updateMutation = useUpdateUser(id ?? '')
  const deleteMutation = useDeleteUser()
  const activateMutation = useActivateUser()
  const deactivateMutation = useDeactivateUser()
  const resetMutation = useResetUserPassword()

  const roleName = React.useMemo(() => {
    if (!user) return '—'
    return (rolesQuery.data?.items ?? []).find((r) => r.id === user.role_id)?.name ?? user.role_id
  }, [rolesQuery.data, user])

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
    if (user) {
      setFullName(user.full_name)
      setPhone(user.phone ?? '')
      setEmail(user.email ?? '')
      setRoleId(user.role_id)
    }
  }

  const handleUpdate = async (): Promise<void> => {
    await updateMutation.mutateAsync({
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      role_id: roleId || null
    })
    setFormDirty(false)
    setEditOpen(false)
  }

  const historyColumns = React.useMemo(
    () => [
      createDataColumn<LoginHistoryDto>({
        id: 'success',
        header: 'النتيجة',
        cell: ({ row }) => (
          <StatusBadge tone={row.success ? 'success' : 'danger'}>
            {row.success ? 'نجاح' : 'فشل'}
          </StatusBadge>
        )
      }),
      createDataColumn<LoginHistoryDto>({
        accessorKey: 'ip_address',
        header: 'عنوان IP',
        cell: ({ row }) => row.ip_address ?? '—'
      }),
      createDataColumn<LoginHistoryDto>({
        accessorKey: 'user_agent',
        header: 'الوكيل',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-caption" title={row.user_agent ?? undefined}>
            {row.user_agent ?? '—'}
          </span>
        )
      }),
      createDataColumn<LoginHistoryDto>({
        accessorKey: 'created_at',
        header: 'التاريخ',
        cell: ({ row }) => new Date(row.created_at).toLocaleString('ar-IQ')
      })
    ],
    []
  )

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/users" replace />

  const activeMapped = user
    ? mapStatus(userActiveKey(user.is_active), USER_ACTIVE_STATUS_MAP)
    : null
  const lockedMapped = user
    ? mapStatus(userLockedKey(user.is_locked), USER_LOCKED_STATUS_MAP)
    : null

  const historyRows = loginHistoryQuery.data?.data ?? []
  const historyTotal = loginHistoryQuery.data?.meta.total ?? 0
  const historyPageCount = Math.max(
    1,
    Math.ceil(historyTotal / Math.max(1, history.pageSize))
  )

  return (
    <Page size="lg" as="main">
      {detailQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detailQuery.isError || !user ? (
        <ErrorState
          title="تعذر تحميل المستخدم"
          message="قد يكون السجل محذوفًا أو غير متاح"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={user.full_name}
            description={user.username}
            status={
              activeMapped
                ? { label: activeMapped.label, tone: activeMapped.tone }
                : undefined
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {lockedMapped ? (
                  <StatusBadge tone={lockedMapped.tone}>{lockedMapped.label}</StatusBadge>
                ) : null}
                <PermissionGuard anyOf={['users.update', 'users.manage']}>
                  <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                    تعديل
                  </Button>
                </PermissionGuard>
                <PermissionGuard anyOf={['users.update', 'users.manage']}>
                  {user.is_active ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deactivateMutation.isPending}
                      onClick={() => void deactivateMutation.mutateAsync(user.id)}
                    >
                      إلغاء التفعيل
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={activateMutation.isPending}
                      onClick={() => void activateMutation.mutateAsync(user.id)}
                    >
                      تفعيل
                    </Button>
                  )}
                </PermissionGuard>
                <PermissionGuard permission="users.manage">
                  <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
                    إعادة تعيين كلمة المرور
                  </Button>
                </PermissionGuard>
                <PermissionGuard anyOf={['users.delete', 'users.manage']}>
                  <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                    حذف
                  </Button>
                </PermissionGuard>
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              {canLoginHistory ? (
                <section className="space-y-3">
                  <h3 className="text-title text-foreground">سجل تسجيل الدخول</h3>
                  {loginHistoryQuery.isError ? (
                    <InlineMessage variant="warning">تعذر تحميل سجل الدخول</InlineMessage>
                  ) : loginHistoryQuery.isLoading ? (
                    <BusyIndicator label="جاري التحميل…" />
                  ) : historyRows.length === 0 ? (
                    <EmptyState title="لا سجلات" description="لم يُسجَّل أي محاولة دخول بعد" />
                  ) : (
                    <>
                      <DataTable
                        columns={historyColumns}
                        data={historyRows}
                        getRowId={(r) => r.id}
                        manual
                        loading={loginHistoryQuery.isFetching}
                        pagination={history}
                        onPaginationChange={setHistory}
                        pageCount={historyPageCount}
                        totalItems={historyTotal}
                      />
                    </>
                  )}
                </section>
              ) : (
                <InlineMessage variant="info">لا تملك صلاحية عرض سجل تسجيل الدخول</InlineMessage>
              )}
            </div>

            <RecordInfoPanel
              title="معلومات الحساب"
              metaItems={[
                { id: 'username', label: 'اسم المستخدم', value: user.username },
                { id: 'role', label: 'الدور', value: roleName },
                { id: 'phone', label: 'الهاتف', value: user.phone ?? '—' },
                { id: 'email', label: 'البريد', value: user.email ?? '—' },
                {
                  id: 'must_change',
                  label: 'تغيير كلمة المرور',
                  value: user.must_change_password ? 'مطلوب' : '—'
                },
                {
                  id: 'failed',
                  label: 'محاولات فاشلة',
                  value: String(user.failed_login_attempts)
                },
                {
                  id: 'last_login',
                  label: 'آخر دخول',
                  value: user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString('ar-IQ')
                    : '—'
                }
              ]}
              createdUpdated={{
                createdAt: user.created_at,
                updatedAt: user.updated_at
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
            <DrawerTitle>تعديل المستخدم</DrawerTitle>
            <DrawerDescription>تحديث بيانات الحساب (PATCH)</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <span className="text-caption text-muted-foreground">الاسم الكامل</span>
                <TextInput
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setFormDirty(true)
                  }}
                />
              </div>
              <div className="space-y-2">
                <span className="text-caption text-muted-foreground">الهاتف</span>
                <TextInput
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setFormDirty(true)
                  }}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <span className="text-caption text-muted-foreground">البريد الإلكتروني</span>
                <TextInput
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFormDirty(true)
                  }}
                  dir="ltr"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <span className="text-caption text-muted-foreground">الدور</span>
                <Select
                  value={roleId}
                  onValueChange={(v) => {
                    setRoleId(v)
                    setFormDirty(true)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rolesQuery.data?.items ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  disabled={!canUpdate || updateMutation.isPending || !formDirty}
                  onClick={() => void handleUpdate()}
                >
                  {updateMutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
                </Button>
                <Button type="button" variant="ghost" onClick={requestCloseEdit}>
                  إلغاء
                </Button>
              </div>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>
              أدخل كلمة مرور جديدة للمستخدم. يتطلب صلاحية users.manage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-caption text-muted-foreground">كلمة المرور الجديدة</span>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              disabled={newPassword.trim().length < 6 || resetMutation.isPending}
              onClick={async () => {
                if (!id) return
                await resetMutation.mutateAsync({ user_id: id, new_password: newPassword })
                setNewPassword('')
                setResetOpen(false)
              }}
            >
              {resetMutation.isPending ? 'جاري التعيين…' : 'تأكيد'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        title="حذف المستخدم"
        description={user ? `هل تريد حذف «${user.full_name}» (${user.username})؟ هذا حذف ناعم.` : null}
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!id) return
          await deleteMutation.mutateAsync(id)
          setDeleteOpen(false)
          void navigate('/users')
        }}
      />
    </Page>
  )
}
