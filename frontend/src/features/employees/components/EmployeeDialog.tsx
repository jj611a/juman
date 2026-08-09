import { useState, useEffect } from 'react'
import { useDialog } from '@/app/providers/DialogProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/shared/utils/cn'
import type { Employee, RoleWithPermissions, CreateEmployeeInput, UpdateEmployeeInput } from '../types'
import { useCreateEmployee, useUpdateEmployee } from '../hooks/useEmployees'

interface EmployeeDialogProps {
  isOpen: boolean
  onClose: () => void
  employee?: Employee | null
  roles: RoleWithPermissions[]
  onSuccess?: () => void
}

export function EmployeeDialog({ isOpen, onClose, employee, roles, onSuccess }: EmployeeDialogProps) {
  const { push } = useToast()
  const [formData, setFormData] = useState<CreateEmployeeInput & UpdateEmployeeInput>({
    username: '',
    fullName: '',
    password: '',
    roleId: '',
    mustChangePassword: true,
  })
  const [errors, setErrors] = useState<Partial<CreateEmployeeInput & UpdateEmployeeInput>>({})
  const [submitting, setSubmitting] = useState(false)
  const isEdit = !!employee

  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()

  useEffect(() => {
    if (isOpen) {
      if (employee) {
        setFormData({
          username: employee.username,
          fullName: employee.fullName,
          password: '',
          roleId: employee.role?.id ?? '',
          mustChangePassword: true,
        })
      } else {
        setFormData({
          username: '',
          fullName: '',
          password: '',
          roleId: '',
          mustChangePassword: true,
        })
      }
      setErrors({})
    }
  }, [isOpen, employee])

  const validate = () => {
    const newErrors: Partial<CreateEmployeeInput & UpdateEmployeeInput> = {}
    if (!formData.username.trim()) newErrors.username = 'اسم المستخدم مطلوب'
    else if (formData.username.length < 2) newErrors.username = 'اسم المستخدم قصير جداً'
    else if (formData.username.length > 64) newErrors.username = 'اسم المستخدم طويل جداً'

    if (!formData.fullName.trim()) newErrors.fullName = 'الاسم الكامل مطلوب'
    else if (formData.fullName.length > 120) newErrors.fullName = 'الاسم الكامل طويل جداً'

    if (!isEdit) {
      if (!formData.password) newErrors.password = 'كلمة المرور مطلوبة'
      else if (formData.password.length < 8) newErrors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
    }

    if (!formData.roleId) newErrors.roleId = 'يجب اختيار دور'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      if (isEdit) {
        const { username, password, mustChangePassword, ...updateData } = formData
        await updateMutation.mutateAsync({ id: employee!.id, input: updateData })
        push({ title: 'تم تحديث الموظف بنجاح', tone: 'success' })
      } else {
        await createMutation.mutateAsync(formData)
        push({ title: 'تم إنشاء الموظف بنجاح', tone: 'success' })
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل العملية'
      push({ title: message, tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal modal-bottom sm:modal-middle" role="dialog">
      <div className="modal-box w-full max-w-lg">
        <h3 className="font-bold text-lg mb-4">{isEdit ? 'تعديل الموظف' : 'إضافة موظف جديد'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label"><span className="label-text">اسم المستخدم *</span></label>
            <input
              type="text"
              className={cn('input input-bordered w-full', errors.username && 'input-error')}
              value={formData.username}
              onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
              disabled={isEdit}
              placeholder="مثال: ahmed.ali"
            />
            {errors.username && <p className="text-error text-sm mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="label"><span className="label-text">الاسم الكامل *</span></label>
            <input
              type="text"
              className={cn('input input-bordered w-full', errors.fullName && 'input-error')}
              value={formData.fullName}
              onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="مثال: أحمد علي"
            />
            {errors.fullName && <p className="text-error text-sm mt-1">{errors.fullName}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="label"><span className="label-text">كلمة المرور *</span></label>
              <input
                type="password"
                className={cn('input input-bordered w-full', errors.password && 'input-error')}
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                placeholder="8 أحرف على الأقل"
              />
              {errors.password && <p className="text-error text-sm mt-1">{errors.password}</p>}
              <p className="text-xs text-base-content/60 mt-1">يجب أن تكون 8 أحرف على الأقل</p>
            </div>
          )}

          <div>
            <label className="label"><span className="label-text">الدور *</span></label>
            <select
              className={cn('select select-bordered w-full', errors.roleId && 'select-error')}
              value={formData.roleId}
              onChange={(e) => setFormData((p) => ({ ...p, roleId: e.target.value }))}
            >
              <option value="">اختر دوراً</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSystem && '(نظام)'}
                </option>
              ))}
            </select>
            {errors.roleId && <p className="text-error text-sm mt-1">{errors.roleId}</p>}
          </div>

          {!isEdit && (
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={formData.mustChangePassword}
                onChange={(e) => setFormData((p) => ({ ...p, mustChangePassword: e.target.checked }))}
              />
              <span className="label-text">إجبار تغيير كلمة المرور عند أول دخول</span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة الموظف'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </div>
  )
}