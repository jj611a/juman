import { useState } from 'react'
import { useDialog } from '@/app/providers/DialogProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { EmployeeTable } from '../components/EmployeeTable'
import { EmployeeDialog } from '../components/EmployeeDialog'
import { useRoles } from '../hooks/useEmployees'
import type { RoleWithPermissions } from '../types'

export function EmployeeListPage() {
  const { push } = useToast()
  const { data: roles } = useRoles()
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreate = async () => {
    // EmployeeDialog handles the mutation internally, this just refreshes the table
    push({ title: 'تم إنشاء الموظف بنجاح', tone: 'success' })
    setDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الموظفون</h1>
          <p className="text-base-content/60">إدارة حسابات الموظفين والأدوار</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setDialogOpen(true)}
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إضافة موظف
        </button>
      </div>

      <EmployeeTable />

      {/* Create/Edit Dialog */}
      <EmployeeDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={null}
        roles={roles ?? []}
        onSuccess={handleCreate}
      />
    </div>
  )
}