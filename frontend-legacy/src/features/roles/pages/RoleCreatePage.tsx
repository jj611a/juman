import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  Checkbox,
  InlineMessage,
  MultiSelect,
  Page,
  PageHeader,
  TextInput
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import { groupPermissionsByModule } from '../api'
import { useCreateRole, usePermissionsCatalog } from '../hooks'

export default function RoleCreatePage(): React.ReactElement {
  const canCreate = useAnyPermission(['roles.create', 'roles.manage'])
  const navigate = useNavigate()
  const createMutation = useCreateRole()
  const permissionsQuery = usePermissionsCatalog()

  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [permissionKeys, setPermissionKeys] = React.useState<string[]>([])

  const permissionOptions = React.useMemo(() => {
    const items = permissionsQuery.data?.items ?? []
    const grouped = groupPermissionsByModule(items)
    const options: { value: string; label: string }[] = []
    for (const [moduleName, perms] of grouped) {
      for (const perm of perms) {
        options.push({
          value: perm.key,
          label: `${moduleName} · ${perm.display_name}`
        })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, 'ar'))
  }, [permissionsQuery.data])

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const canSubmit = name.trim().length >= 2

  const submit = async (): Promise<void> => {
    const res = await createMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
      permission_keys: permissionKeys.length > 0 ? permissionKeys : undefined
    })
    void navigate(`/roles/${res.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="دور جديد" description="إنشاء دور مع صلاحيات أولية" />

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-caption text-muted-foreground">اسم الدور</span>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: كاشير"
          />
        </div>
        <div className="space-y-2">
          <span className="text-caption text-muted-foreground">الوصف (اختياري)</span>
          <TextInput
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر للدور"
          />
        </div>
        <label className="flex items-center gap-2">
          <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
          <span className="text-body">دور نشط</span>
        </label>

        <div className="space-y-2">
          <span className="text-caption text-muted-foreground">الصلاحيات</span>
          {permissionsQuery.isError ? (
            <InlineMessage variant="warning">تعذر تحميل الصلاحيات</InlineMessage>
          ) : (
            <MultiSelect
              options={permissionOptions}
              value={permissionKeys}
              onChange={setPermissionKeys}
              placeholder="اختر الصلاحيات…"
              aria-label="صلاحيات الدور"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" disabled={!canSubmit || createMutation.isPending} onClick={() => void submit()}>
            {createMutation.isPending ? 'جاري الإنشاء…' : 'إنشاء الدور'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void navigate('/roles')}>
            إلغاء
          </Button>
        </div>
      </div>
    </Page>
  )
}
