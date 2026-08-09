import { useState } from 'react'
import { useLoaderData, useNavigate, useParams } from 'react-router'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/shared/utils/cn'
import type { Employee, RoleWithPermissions, ResetPasswordInput } from '../types'
import { useEmployee, useRoles, usePermissions, useDeactivateEmployee, useActivateEmployee, useUnlockEmployee, useResetEmployeePassword, useDeleteEmployee, useRestoreEmployee } from '../hooks/useEmployees'
import { EmployeeDialog } from '../components/EmployeeDialog'

export function EmployeeDetailPage() {
  const navigate = useNavigate()
  const { push } = useToast()
  const { id } = useParams()
  const { data: employee, isLoading, error, refetch } = useEmployee(id ?? null)
  const { data: roles } = useRoles()
  const { data: permissions } = usePermissions()
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')

  const deactivateMut = useDeactivateEmployee()
  const activateMut = useActivateEmployee()
  const unlockMut = useUnlockEmployee()
  const resetMut = useResetEmployeePassword()
  const deleteMut = useDeleteEmployee()
  const restoreMut = useRestoreEmployee()

  const handleDeactivate = async () => {
    try {
      await deactivateMut.mutateAsync(id!)
      push({ title: 'تم إلغاء تفعيل الموظف', tone: 'success' })
      refetch()
    } catch {
      push({ title: 'فشل إلغاء التفعيل', tone: 'error' })
    }
  }

  const handleActivate = async () => {
    try {
      await activateMut.mutateAsync(id!)
      push({ title: 'تم تفعيل الموظف', tone: 'success' })
      refetch()
    } catch {
      push({ title: 'فشل التفعيل', tone: 'error' })
    }
  }

  const handleUnlock = async () => {
    try {
      await unlockMut.mutateAsync(id!)
      push({ title: 'تم إلغاء قفل الحساب', tone: 'success' })
      refetch()
    } catch {
      push({ title: 'فشل إلغاء القفل', tone: 'error' })
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPassword || resetPassword.length < 8) {
      push({ title: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', tone: 'error' })
      return
    }
    try {
      await resetMut.mutateAsync({ id: id!, input: { newPassword: resetPassword } })
      push({ title: 'تم إعادة تعيين كلمة المرور', tone: 'success' })
      setResetOpen(false)
      setResetPassword('')
      refetch()
    } catch {
      push({ title: 'فشل إعادة تعيين كلمة المرور', tone: 'error' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(id!)
      push({ title: 'تم حذف الموظف', tone: 'success' })
      navigate('/employees')
    } catch {
      push({ title: 'فشل الحذف', tone: 'error' })
    }
  }

  const handleRestore = async () => {
    try {
      await restoreMut.mutateAsync(id!)
      push({ title: 'تم استعادة الموظف', tone: 'success' })
      refetch()
    } catch {
      push({ title: 'فشل الاستعادة', tone: 'error' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-base-content/10 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-base-200/50 rounded-xl border border-base-content/10" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="alert alert-error" role="alert">
        <span>فشل تحميل بيانات الموظف</span>
        <button className="btn btn-sm btn-ghost" onClick={() => navigate('/employees')}>العودة للقائمة</button>
      </div>
    )
  }

  const emp = employee!
  const role = roles?.find((r) => r.id === emp.role?.id)
  const rolePermissions = role?.permissionKeys ?? []
  const permDetails = permissions?.filter((p) => rolePermissions.includes(p.key)) ?? []

  const getStatusBadge = () => {
    if (emp.deletedAt) return <span className="badge badge-ghost">محذوف</span>
    if (emp.isLocked) return <span className="badge badge-error">مقفل</span>
    if (!emp.isActive) return <span className="badge badge-warning">غير نشط</span>
    return <span className="badge badge-success">نشط</span>
  }

  const canEdit = !emp.deletedAt
  const canDeactivate = emp.isActive && !emp.deletedAt
  const canActivate = !emp.isActive && !emp.deletedAt
  const canUnlock = emp.isLocked
  const canDelete = !emp.deletedAt
  const canRestore = !!emp.deletedAt

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{emp.fullName}</h1>
          <p className="text-base-content/60 font-mono">@{emp.username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button className="btn btn-ghost" onClick={() => setEditOpen(true)}>تعديل</button>
          )}
          {canDeactivate && (
            <button className="btn btn-ghost btn-error" onClick={handleDeactivate} disabled={deactivateMut.isPending}>إلغاء تفعيل</button>
          )}
          {canActivate && (
            <button className="btn btn-ghost btn-success" onClick={handleActivate} disabled={activateMut.isPending}>تفعيل</button>
          )}
          {canUnlock && (
            <button className="btn btn-ghost btn-warning" onClick={handleUnlock} disabled={unlockMut.isPending}>إلغاء القفل</button>
          )}
          {canDelete && (
            <button className="btn btn-ghost btn-error" onClick={handleDelete} disabled={deleteMut.isPending}>حذف</button>
          )}
          {canRestore && (
            <button className="btn btn-ghost btn-info" onClick={handleRestore} disabled={restoreMut.isPending}>استعادة</button>
          )}
          <button className="btn btn-ghost" onClick={() => setResetOpen(true)}>إعادة تعيين كلمة المرور</button>
        </div>
      </div>

      {/* Main Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-200/50 border border-base-content/10">
          <div className="card-body">
            <h3 className="card-title text-base-content/60 text-sm">المعلومات الأساسية</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-base-content/60">اسم المستخدم</dt>
                <dd className="font-mono font-medium">{emp.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">الاسم الكامل</dt>
                <dd className="font-medium">{emp.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">الدور</dt>
                <dd className="font-medium">{emp.role?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">الحالة</dt>
                <dd>{getStatusBadge()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">تغيير إجباري لكلمة المرور</dt>
                <dd>{emp.mustChangePassword ? 'نعم' : 'لا'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">مُقفل</dt>
                <dd>{emp.isLocked ? 'نعم' : 'لا'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="card bg-base-200/50 border border-base-content/10">
          <div className="card-body">
            <h3 className="card-title text-base-content/60 text-sm">أوقات الدخول</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-base-content/60">آخر دخول</dt>
                <dd className="font-medium">
                  {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleString('ar-SA') : 'لم يسجل دخولاً'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">إنشاء الحساب</dt>
                <dd className="font-medium">{new Date(emp.createdAt).toLocaleString('ar-SA')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base-content/60">آخر تحديث</dt>
                <dd className="font-medium">{new Date(emp.updatedAt).toLocaleString('ar-SA')}</dd>
              </div>
              {emp.deletedAt && (
                <div className="flex justify-between">
                  <dt className="text-base-content/60">تاريخ الحذف</dt>
                  <dd className="font-medium text-error">{new Date(emp.deletedAt).toLocaleString('ar-SA')}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="card bg-base-200/50 border border-base-content/10">
          <div className="card-body">
            <h3 className="card-title text-base-content/60 text-sm">الصلاحيات (عبر الدور)</h3>
            {permDetails.length === 0 ? (
              <p className="text-base-content/60 text-sm">لا توجد صلاحيات لهذا الدور</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {permDetails.map((p) => (
                  <span
                    key={p.key}
                    className="badge badge-primary badge-sm"
                    title={`${p.module}.${p.key}: ${p.description}`}
                  >
                    {p.displayName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Details */}
      {role && (
        <div className="card bg-base-200/50 border border-base-content/10">
          <div className="card-body">
            <h3 className="card-title text-base-content/60 text-sm">تفاصيل الدور: {role.name}</h3>
            <p className="text-base-content/70 text-sm mb-4">{role.description}</p>
            <div className="flex flex-wrap gap-2">
              <span className={cn('badge', role.isSystem ? 'badge-primary' : 'badge-secondary')}>
                {role.isSystem ? 'دور نظام' : 'دور مخصص'}
              </span>
              <span className="badge badge-ghost">عدد الصلاحيات: {rolePermissions.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <EmployeeDialog
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={emp}
        roles={roles ?? []}
        onSuccess={() => refetch()}
      />

      {resetOpen && (
        <div className="modal modal-bottom sm:modal-middle" role="dialog">
          <div className="modal-box w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">إعادة تعيين كلمة المرور</h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-base-content/70 text-sm">
                سيتم تعيين كلمة مرور جديدة للمستخدم <strong>{emp.fullName}</strong>. يجب أن تكون 8 أحرف على الأقل.
              </p>
              <div>
                <label className="label"><span className="label-text">كلمة المرور الجديدة *</span></label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="8 أحرف على الأقل"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" disabled={resetMut.isPending}>
                  {resetMut.isPending ? 'جاري التعيين...' : 'تعيين كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop" onSubmit={() => setResetOpen(false)}>
            <button>close</button>
          </form>
        </div>
      )}
    </div>
  )
}