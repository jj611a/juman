import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { 
  useReservationsList
} from '../hooks/useReservations'
import { ReservationDialog } from '../dialogs/ReservationDialog'
import type { ReservationDto } from '../api/api'
import { 
  Plus, 
  Search, 
  Eye, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  AlertTriangle,
  CalendarDays,
  CalendarCheck
} from 'lucide-react'

export function ReservationListPage() {
  const { can } = usePermission()
  const navigate = useNavigate()

  // Filter & Search states
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [limit] = useState(10)
  const [offset, setOffset] = useState(0)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)

  // List Query Hook
  const { data, isLoading, isError, refetch } = useReservationsList({
    q: q.trim() || undefined,
    status: status || undefined,
    limit,
    offset
  })

  const handlePageChange = (nextOffset: number) => {
    if (nextOffset >= 0) {
      setOffset(nextOffset)
    }
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = data ? Math.ceil((data.meta?.total ?? 0) / limit) : 1

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <CalendarDays className="text-primary" />
            جدول حجوزات الفساتين والقطع
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            متابعة تواريخ حجز العملاء للقطع وتأكيد الحجوزات وإصدار الفساتين للتأجير
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {can(PERMISSION.RESERVATION_CREATE) && (
            <button onClick={() => setDialogOpen(true)} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              حجز قطعة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 bg-base-300/40 p-4 rounded-xl border border-base-content/5 items-end">
        <div className="form-control w-full col-span-2">
          <span className="label-text mb-1.5 text-xs text-base-content/50">بحث سريع بالاسم أو الرقم</span>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث برقم الحجز..."
              className="input input-bordered w-full bg-base-200 pl-10 text-xs h-10"
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
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">حالة الحجز</span>
          <select
            className="select select-bordered w-full bg-base-200 text-xs h-10 min-h-0"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="confirmed">مؤكد</option>
            <option value="checked_out">مستلم (Checked Out)</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغي</option>
            <option value="expired">منتهي الصلاحية</option>
          </select>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-outline border-base-content/10 hover:border-primary/20 btn-md text-xs w-full flex items-center justify-center gap-2 h-10 min-h-0"
        >
          <RefreshCw size={14} />
          تحديث القائمة
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
          <span>حدث خطأ أثناء تحميل سجلات الحجوزات.</span>
        </div>
      ) : (data?.items || []).length === 0 ? (
        <div className="text-center py-16 bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl flex flex-col items-center justify-center">
          <CalendarCheck size={48} className="text-base-content/20 mb-3" />
          <p className="font-bold text-base-content/50">لا توجد حجوزات مطابقة للبحث</p>
          <p className="text-xs text-base-content/40 mt-1">تأكد من اختيار فلاتر صحيحة</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-base-content/10 bg-base-300/40 rounded-xl shadow-md">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-base-content/10 text-xs text-base-content/60">
                <th>رقم الحجز</th>
                <th>اسم العميل</th>
                <th>تاريخ الحجز</th>
                <th>تاريخ التسليم</th>
                <th>تاريخ الإرجاع</th>
                <th>الحالة</th>
                <th className="text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((res) => (
                <tr key={res.id} className="border-b border-base-content/5 hover:bg-base-200/40 transition-colors">
                  <td className="font-mono font-bold text-primary">{res.reservationNumber}</td>
                  <td className="font-bold">{res.customer?.fullName || '—'}</td>
                  <td>{new Date(res.startDate).toLocaleDateString('ar-AE')}</td>
                  <td>{new Date(res.expectedCheckoutDate).toLocaleDateString('ar-AE')}</td>
                  <td>{new Date(res.expectedReturnDate).toLocaleDateString('ar-AE')}</td>
                  <td>
                    <span className="badge badge-neutral badge-xs font-mono text-[9px] py-2">{res.status}</span>
                  </td>
                  <td className="text-left flex justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/reservations/${res.id}`)}
                      className="btn btn-ghost btn-square btn-xs text-primary"
                      title="عرض التفاصيل"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-between items-center p-4 border-t border-base-content/5 bg-base-300/60">
            <span className="text-xs text-base-content/50">
              عرض {offset + 1} - {Math.min(offset + limit, data?.meta?.total ?? 0)} من إجمالي {data?.meta?.total ?? 0} حجوزات
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
                disabled={offset + limit >= (data?.meta?.total ?? 0)}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Dialog */}
      <ReservationDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
