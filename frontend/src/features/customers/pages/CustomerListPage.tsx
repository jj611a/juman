import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useCustomersList, useDeleteCustomer, useRestoreCustomer } from '../hooks/useCustomers'
import { CustomerDialog } from '../dialogs/CustomerDialog'
import type { CustomerDto } from '../api/api'
import { ROUTES } from '@/shared/constants/routes'
import { 
  UserPlus, 
  Search, 
  Trash2, 
  RotateCcw, 
  Edit3, 
  Eye, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle,
  Users
} from 'lucide-react'

export function CustomerListPage() {
  const { can } = usePermission()
  const navigate = useNavigate()

  // Filter & Search states
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [limit] = useState(10)
  const [offset, setOffset] = useState(0)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null)

  // Query Hook
  const { data, isLoading, isError, refetch } = useCustomersList({
    q: q.trim() || undefined,
    status: status || undefined,
    deleted: showDeleted,
    sortBy,
    sortDir,
    limit,
    offset
  })

  // Mutation Hooks
  const deleteCustomer = useDeleteCustomer()
  const restoreCustomer = useRestoreCustomer()

  const handleEditClick = (cust: CustomerDto) => {
    setSelectedCustomer(cust)
    setDialogOpen(true)
  }

  const handleCreateClick = () => {
    setSelectedCustomer(null)
    setDialogOpen(true)
  }

  const handleDeleteClick = async (id: string, name: string) => {
    const ok = window.confirm(`هل أنت متأكد من حذف العميل "${name}" مؤقتاً؟`)
    if (!ok) return
    try {
      await deleteCustomer.mutateAsync(id)
    } catch (err: any) {
      alert(err?.message || 'فشل حذف العميل.')
    }
  }

  const handleRestoreClick = async (id: string, name: string) => {
    const ok = window.confirm(`هل تريد استعادة العميل "${name}"؟`)
    if (!ok) return
    try {
      await restoreCustomer.mutateAsync(id)
    } catch (err: any) {
      alert(err?.message || 'فشل استعادة العميل.')
    }
  }

  const handlePageChange = (nextOffset: number) => {
    if (nextOffset >= 0) {
      setOffset(nextOffset)
    }
  }

  const toggleDeletedView = () => {
    setShowDeleted(!showDeleted)
    setOffset(0)
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = data ? Math.ceil(data.total / limit) : 1

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Users className="text-primary" />
            إدارة حسابات العملاء
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            عرض وتعديل وتصفية سجلات العملاء والتحقق من حساباتهم المالية
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={toggleDeletedView}
            className={`btn btn-sm ${showDeleted ? 'btn-error' : 'btn-outline border-base-content/10'}`}
          >
            {showDeleted ? 'عرض النشطين' : 'سلة المحذوفات'}
          </button>
          {can(PERMISSION.CUSTOMER_CREATE) && (
            <button onClick={handleCreateClick} className="btn btn-primary btn-sm gap-2">
              <UserPlus size={14} />
              إضافة عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 bg-base-300/40 p-4 rounded-xl border border-base-content/5 items-end">
        <div className="form-control w-full col-span-2">
          <span className="label-text mb-1.5 text-xs text-base-content/50">بحث سريع بالاسم أو الهاتف</span>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بالاسم، رقم الجوال..."
              className="input input-bordered w-full bg-base-200 pl-10"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOffset(0)
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
              <Search size={16} />
            </span>
          </div>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">حالة الحساب</span>
          <select
            className="select select-bordered w-full bg-base-200 text-xs"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-outline border-base-content/10 hover:border-primary/20 btn-md text-xs w-full flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          تحديث التصفية
        </button>
      </div>

      {/* Table & List View */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-base-300/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="alert alert-error text-sm flex gap-2">
          <AlertTriangle size={18} />
          <span>حدث خطأ أثناء تحميل قائمة العملاء.</span>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-16 bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl flex flex-col items-center justify-center">
          <Users size={48} className="text-base-content/20 mb-3" />
          <p className="font-bold text-base-content/50">لا يوجد عملاء مطابقين للبحث</p>
          <p className="text-xs text-base-content/40 mt-1">تأكد من كتابة الاسم أو الرقم بشكل صحيح</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-base-content/10 bg-base-300/40 rounded-xl shadow-md">
          <table className="table table-sm md:table-md w-full">
            <thead>
              <tr className="border-b border-base-content/10 text-xs text-base-content/60">
                <th>رقم العميل</th>
                <th>الاسم الكامل</th>
                <th>رقم الهاتف</th>
                <th>المدينة</th>
                <th>الحالة</th>
                <th>تاريخ التسجيل</th>
                <th className="text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map((cust) => (
                <tr key={cust.id} className="border-b border-base-content/5 hover:bg-base-200/40 transition-colors">
                  <td className="font-mono font-bold text-primary">{cust.customerNumber}</td>
                  <td className="font-bold">{cust.fullName}</td>
                  <td className="font-mono text-xs">{cust.phone}</td>
                  <td>{cust.city || '—'}</td>
                  <td>
                    {cust.status === 'active' ? (
                      <span className="badge badge-success badge-xs font-bold text-[9px] rounded-sm">نشط</span>
                    ) : (
                      <span className="badge badge-ghost badge-xs font-bold text-[9px] rounded-sm">غير نشط</span>
                    )}
                  </td>
                  <td className="text-xs text-base-content/50">
                    {new Date(cust.createdAt).toLocaleDateString('ar-AE')}
                  </td>
                  <td className="text-left flex justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/customers/${cust.id}`)}
                      className="btn btn-ghost btn-square btn-xs text-primary"
                      title="عرض الملف"
                    >
                      <Eye size={14} />
                    </button>
                    {!showDeleted ? (
                      <>
                        {can(PERMISSION.CUSTOMER_UPDATE) && (
                          <button
                            onClick={() => handleEditClick(cust)}
                            className="btn btn-ghost btn-square btn-xs text-info"
                            title="تعديل البيانات"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {can(PERMISSION.CUSTOMER_DELETE) && (
                          <button
                            onClick={() => void handleDeleteClick(cust.id, cust.fullName)}
                            className="btn btn-ghost btn-square btn-xs text-error"
                            title="حذف مؤقت"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    ) : (
                      can(PERMISSION.CUSTOMER_RESTORE) && (
                        <button
                          onClick={() => void handleRestoreClick(cust.id, cust.fullName)}
                          className="btn btn-ghost btn-square btn-xs text-success"
                          title="استعادة"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-between items-center p-4 border-t border-base-content/5 bg-base-300/60">
            <span className="text-xs text-base-content/50">
              عرض {offset + 1} - {Math.min(offset + limit, data?.total ?? 0)} من إجمالي {data?.total ?? 0} عملاء
            </span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => handlePageChange(offset - limit)}
                disabled={offset === 0}
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-xs font-bold self-center px-2">صفحة {page} من {totalPages}</span>
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => handlePageChange(offset + limit)}
                disabled={offset + limit >= (data?.total ?? 0)}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Create/Edit Dialog */}
      <CustomerDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={selectedCustomer}
      />
    </div>
  )
}
