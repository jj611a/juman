import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmationDialog,
  EntityHeader,
  ErrorState,
  InlineMessage,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  StatusBadge,
  Switch,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import type { PermissionDto } from '@/services/domainTypes'
import { groupPermissionsByModule } from '../api'
import {
  useAssignRolePermissions,
  useDeleteRole,
  usePermissionsCatalog,
  useRemoveRolePermission,
  useRole,
  useRolePermissions,
  useUpdateRole
} from '../hooks'

export default function RoleDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = useAnyPermission(['roles.view', 'roles.manage'])
  const canUpdate = useAnyPermission(['roles.update', 'roles.manage'])
  const canDelete = useAnyPermission(['roles.delete', 'roles.manage'])

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [metaDirty, setMetaDirty] = React.useState(false)
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null)

  const detailQuery = useRole(id)
  const assignedQuery = useRolePermissions(id)
  const catalogQuery = usePermissionsCatalog()
  const role = detailQuery.data?.data

  const updateMutation = useUpdateRole(id ?? '')
  const deleteMutation = useDeleteRole()
  const assignMutation = useAssignRolePermissions(id ?? '')
  const removeMutation = useRemoveRolePermission(id ?? '')

  React.useEffect(() => {
    if (!role) return
    setName(role.name)
    setDescription(role.description ?? '')
    setIsActive(role.is_active)
    setMetaDirty(false)
  }, [role])

  const assignedByKey = React.useMemo(() => {
    const map = new Map<string, PermissionDto>()
    const fromRole = role?.permissions ?? []
    const fromQuery = assignedQuery.data ?? []
    for (const perm of [...fromRole, ...fromQuery]) {
      map.set(perm.key, perm)
    }
    return map
  }, [role?.permissions, assignedQuery.data])

  const groupedCatalog = React.useMemo(() => {
    const items = catalogQuery.data?.items ?? []
    return [...groupPermissionsByModule(items).entries()].sort(([a], [b]) =>
      a.localeCompare(b, 'ar')
    )
  }, [catalogQuery.data])

  const handleSaveMeta = async (): Promise<void> => {
    await updateMutation.mutateAsync({
      name: name.trim() || null,
      description: description.trim() || null,
      is_active: isActive
    })
    setMetaDirty(false)
  }

  const handlePermissionToggle = async (perm: PermissionDto, checked: boolean): Promise<void> => {
    if (!id || !canUpdate) return
    setTogglingKey(perm.key)
    try {
      if (checked) {
        await assignMutation.mutateAsync({ permission_keys: [perm.key] })
      } else {
        const assigned = assignedByKey.get(perm.key)
        if (!assigned) return
        await removeMutation.mutateAsync(assigned.id)
      }
    } finally {
      setTogglingKey(null)
    }
  }

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/roles" replace />

  return (
    <Page size="lg" as="main">
      {detailQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detailQuery.isError || !role ? (
        <ErrorState
          title="تعذر تحميل الدور"
          message="قد يكون السجل محذوفًا أو غير متاح"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={role.name}
            description={role.description ?? undefined}
            status={{
              label: role.is_active ? 'نشط' : 'غير نشط',
              tone: role.is_active ? 'success' : 'neutral'
            }}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {role.is_system ? <Badge variant="outline">دور نظام</Badge> : null}
                {!role.is_system ? (
                  <PermissionGuard anyOf={['roles.delete', 'roles.manage']}>
                    <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                      حذف
                    </Button>
                  </PermissionGuard>
                ) : null}
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <section className="space-y-4 rounded-md border border-border p-4">
                <h3 className="text-title text-foreground">بيانات الدور</h3>
                {!canUpdate ? (
                  <InlineMessage variant="info">لا تملك صلاحية تعديل الدور</InlineMessage>
                ) : null}
                <div className="space-y-2">
                  <span className="text-caption text-muted-foreground">الاسم</span>
                  <TextInput
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setMetaDirty(true)
                    }}
                    disabled={!canUpdate}
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-caption text-muted-foreground">الوصف</span>
                  <TextInput
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      setMetaDirty(true)
                    }}
                    disabled={!canUpdate}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={isActive}
                    disabled={!canUpdate}
                    onCheckedChange={(v) => {
                      setIsActive(v === true)
                      setMetaDirty(true)
                    }}
                  />
                  <span className="text-body">دور نشط</span>
                </label>
                {canUpdate ? (
                  <Button
                    type="button"
                    disabled={!metaDirty || updateMutation.isPending}
                    onClick={() => void handleSaveMeta()}
                  >
                    {updateMutation.isPending ? 'جاري الحفظ…' : 'حفظ البيانات (PUT)'}
                  </Button>
                ) : null}
              </section>

              <section className="space-y-4">
                <h3 className="text-title text-foreground">مصفوفة الصلاحيات</h3>
                {catalogQuery.isError ? (
                  <InlineMessage variant="warning">تعذر تحميل الصلاحيات</InlineMessage>
                ) : catalogQuery.isLoading ? (
                  <BusyIndicator label="جاري تحميل الصلاحيات…" />
                ) : groupedCatalog.length === 0 ? (
                  <InlineMessage variant="info">لا توجد صلاحيات</InlineMessage>
                ) : (
                  groupedCatalog.map(([moduleName, perms]) => (
                    <div key={moduleName} className="space-y-2 rounded-md border border-border p-4">
                      <h4 className="font-medium text-foreground">{moduleName}</h4>
                      <ul className="divide-y divide-border">
                        {perms.map((perm) => {
                          const assigned = assignedByKey.has(perm.key)
                          const busy = togglingKey === perm.key
                          return (
                            <li
                              key={perm.id}
                              className="flex flex-wrap items-center justify-between gap-3 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{perm.display_name}</p>
                                <p className="text-caption text-muted-foreground" dir="ltr">
                                  {perm.key}
                                </p>
                                {perm.description ? (
                                  <p className="text-caption text-muted-foreground">
                                    {perm.description}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge tone={assigned ? 'success' : 'neutral'}>
                                  {assigned ? 'مفعّل' : 'معطّل'}
                                </StatusBadge>
                                <Switch
                                  checked={assigned}
                                  disabled={!canUpdate || busy || assignMutation.isPending || removeMutation.isPending}
                                  onCheckedChange={(checked) =>
                                    void handlePermissionToggle(perm, checked)
                                  }
                                  aria-label={perm.display_name}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            </div>

            <RecordInfoPanel
              title="معلومات الدور"
              metaItems={[
                {
                  id: 'system',
                  label: 'نوع الدور',
                  value: role.is_system ? 'نظام' : 'مخصص'
                },
                {
                  id: 'perm_count',
                  label: 'عدد الصلاحيات',
                  value: String(assignedByKey.size)
                }
              ]}
              createdUpdated={{
                createdAt: role.created_at,
                updatedAt: role.updated_at
              }}
            />
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف الدور"
        description={
          role && !role.is_system
            ? `هل تريد حذف الدور «${role.name}»؟`
            : null
        }
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!id || role?.is_system) return
          await deleteMutation.mutateAsync(id)
          setDeleteOpen(false)
          void navigate('/roles')
        }}
      />
    </Page>
  )
}
