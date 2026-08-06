import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  Checkbox,
  InlineMessage,
  Page,
  PageHeader,
  PasswordInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput
} from '@/components/ui'
import { useRolesList } from '@/features/roles/hooks'
import { useAnyPermission } from '@/hooks/usePermission'
import { useCreateUser } from '../hooks'

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export default function UserCreatePage(): React.ReactElement {
  const canCreate = useAnyPermission(['users.create', 'users.manage'])
  const navigate = useNavigate()
  const createMutation = useCreateUser()
  const rolesQuery = useRolesList({ active_only: true })

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [fullName, setFullName] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [mustChangePassword, setMustChangePassword] = React.useState(true)

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const canSubmit =
    username.trim().length >= 2 &&
    password.trim().length >= 6 &&
    fullName.trim().length >= 2 &&
    Boolean(roleId)

  const submit = async (): Promise<void> => {
    const res = await createMutation.mutateAsync({
      username: username.trim(),
      password,
      full_name: fullName.trim(),
      role_id: roleId,
      phone: phone.trim() || null,
      email: email.trim() || null,
      must_change_password: mustChangePassword
    })
    void navigate(`/users/${res.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="مستخدم جديد" description="إنشاء حساب موظف جديد" />

      <div className="space-y-4">
        <Field label="اسم المستخدم">
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            dir="ltr"
            autoComplete="off"
          />
        </Field>
        <Field label="كلمة المرور">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="الاسم الكامل">
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم بالعربية"
          />
        </Field>
        <div className="space-y-2">
          <span className="text-caption text-muted-foreground">الدور</span>
          <Select value={roleId} onValueChange={setRoleId}>
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
          {rolesQuery.isError ? (
            <InlineMessage variant="warning">تعذر تحميل الأدوار</InlineMessage>
          ) : null}
        </div>
        <Field label="الهاتف (اختياري)">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </Field>
        <Field label="البريد الإلكتروني (اختياري)">
          <TextInput
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            type="email"
          />
        </Field>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={mustChangePassword}
            onCheckedChange={(v) => setMustChangePassword(v === true)}
          />
          <span className="text-body">يجب تغيير كلمة المرور عند أول دخول</span>
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" disabled={!canSubmit || createMutation.isPending} onClick={() => void submit()}>
            {createMutation.isPending ? 'جاري الإنشاء…' : 'إنشاء المستخدم'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void navigate('/users')}>
            إلغاء
          </Button>
        </div>
      </div>
    </Page>
  )
}
