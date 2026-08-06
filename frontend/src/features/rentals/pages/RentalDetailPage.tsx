import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { 
  useRentalDetail,
  useCheckoutRental,
  useReturnRental,
  useCompleteRental,
  useCancelRental
} from '../hooks/useRentals'
import { 
  ChevronRight, 
  Tag, 
  DollarSign, 
  Calendar, 
  Layers, 
  Info,
  AlertTriangle,
  History,
  Activity,
  CheckCircle,
  XCircle,
  Undo
} from 'lucide-react'

// Helper for currency conversion
function formatFils(fils: number | null | undefined): string {
  if (!fils) return '0.00 د.إ'
  return `${(fils / 1000).toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`
}

export function RentalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermission()

  // Queries & Mutations
  const { data: rental, isLoading, isError } = useRentalDetail(id || '')
  
  const checkoutMutation = useCheckoutRental(id || '')
  const returnMutation = useReturnRental(id || '')
  const completeMutation = useCompleteRental(id || '')
  const cancelMutation = useCancelRental(id || '')

  // Dialog & Reason states
  const [reason, setReason] = useState('')
  const [depositAmountFils, setDepositAmountFils] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse p-6" dir="rtl">
        <div className="h-8 w-1/4 bg-base-300 rounded" />
        <div className="h-32 w-full bg-base-300 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-base-300 rounded-xl" />
          <div className="h-48 col-span-2 bg-base-300 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !rental) {
    return (
      <div className="alert alert-error text-sm flex gap-2" dir="rtl">
        <AlertTriangle size={18} />
        <span>حدث خطأ أثناء تحميل تفاصيل عقد التأجير. قد يكون العقد غير موجود.</span>
      </div>
    )
  }

  const handleCheckout = async () => {
    setActionError(null)
    const confirmed = window.confirm('هل أنت متأكد من تسليم القطع وتفعيل عقد التأجير؟')
    if (!confirmed) return
    try {
      await checkoutMutation.mutateAsync({ reason: reason || undefined, depositAmountFils: depositAmountFils || undefined })
      setReason('')
    } catch (err: any) {
      setActionError(err?.message || 'فشلت عملية تسليم القطع.')
    }
  }

  const handleReturn = async () => {
    setActionError(null)
    const confirmed = window.confirm('هل أنت متأكد من بدء عملية إرجاع القطع؟')
    if (!confirmed) return
    try {
      await returnMutation.mutateAsync(reason || undefined)
      setReason('')
    } catch (err: any) {
      setActionError(err?.message || 'فشل بدء عملية إرجاع القطع.')
    }
  }

  const handleComplete = async () => {
    setActionError(null)
    const confirmed = window.confirm('هل أنت متأكد من إغلاق واكتمال عقد التأجير؟')
    if (!confirmed) return
    try {
      await completeMutation.mutateAsync(reason || undefined)
      setReason('')
    } catch (err: any) {
      setActionError(err?.message || 'فشلت عملية إغلاق عقد التأجير.')
    }
  }

  const handleCancel = async () => {
    setActionError(null)
    const confirmed = window.confirm('هل أنت متأكد من إلغاء عقد التأجير؟')
    if (!confirmed) return
    try {
      await cancelMutation.mutateAsync(reason || undefined)
      setReason('')
    } catch (err: any) {
      setActionError(err?.message || 'فشلت عملية إلغاء العقد.')
    }
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-base-content/50">
        <button onClick={() => navigate('/rentals')} className="hover:text-primary transition-colors">
          سجل التأجير
        </button>
        <ChevronRight size={14} />
        <span className="font-bold text-base-content">{rental.rentalNumber}</span>
      </div>

      {actionError && (
        <div className="alert alert-error text-xs p-3">
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-base-300/40 p-6 rounded-2xl border border-base-content/5">
        <div className="avatar placeholder">
          <div className="bg-primary/20 text-primary w-24 h-24 rounded-xl border border-primary/30 flex items-center justify-center">
            <Layers size={48} className="text-primary/70" />
          </div>
        </div>
        <div className="flex-1 text-center md:text-right space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl font-black text-base-content">عقد تأجير رقم {rental.rentalNumber}</h1>
            <span className="badge badge-neutral font-mono text-xs">{rental.status}</span>
          </div>
          <p className="text-xs text-base-content/40 font-mono">ID: {rental.id}</p>
          <div className="text-xs text-base-content/60 mt-2">
            تم الإنشاء بتاريخ: {new Date(rental.createdAt).toLocaleDateString('ar-AE')}
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column: Customer & Details */}
        <div className="space-y-6">
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 h-fit space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <Info size={16} className="text-primary" />
              تفاصيل عقد التأجير
            </h3>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">تاريخ التأجير</span>
                <span className="font-semibold">{new Date(rental.rentalDate).toLocaleDateString('ar-AE')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">الإرجاع المتوقع</span>
                <span className="font-semibold">{new Date(rental.expectedReturnDate).toLocaleDateString('ar-AE')}</span>
              </div>
              {rental.actualReturnDate && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-base-content/50">تاريخ الإرجاع الفعلي</span>
                  <span className="font-semibold">{new Date(rental.actualReturnDate).toLocaleDateString('ar-AE')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 h-fit space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <Activity size={16} className="text-success" />
              بيانات العميل المستأجر
            </h3>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">الاسم بالكامل</span>
                <span className="font-semibold text-primary">{rental.customer?.fullName}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">رقم الهاتف</span>
                <span className="font-semibold">{rental.customer?.phone}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Items, Finance and Timeline Operations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Sub-table list */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <Tag size={16} className="text-primary" />
              القطع المستأجرة في العقد
            </h3>
            <div className="overflow-x-auto">
              <table className="table table-xs w-full text-xs">
                <thead>
                  <tr className="border-b border-base-content/10 text-base-content/50">
                    <th>القطعة</th>
                    <th>كود المخزن</th>
                    <th className="text-left">سعر التأجير المتفق عليه</th>
                  </tr>
                </thead>
                <tbody>
                  {(rental.items || []).map((item, index) => (
                    <tr key={index} className="border-b border-base-content/5">
                      <td className="font-bold">{item.item?.displayName || '—'}</td>
                      <td className="font-mono">{item.item?.internalCode || '—'}</td>
                      <td className="text-left font-bold text-primary">{formatFils(item.agreedRentalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlement / Finance Status */}
          {rental.settlement && (
            <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
              <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
                <DollarSign size={16} className="text-success" />
                الحساب المالي والتسويات
              </h3>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="bg-base-200/50 p-4 rounded-xl">
                  <span className="text-xs text-base-content/50">المبلغ الإجمالي المستحق</span>
                  <p className="text-lg font-black text-primary mt-1">{formatFils(rental.settlement.totalFils)}</p>
                </div>
                <div className="bg-base-200/50 p-4 rounded-xl">
                  <span className="text-xs text-base-content/50">المبلغ المدفوع</span>
                  <p className="text-lg font-black text-success mt-1">{formatFils(rental.settlement.paidFils)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Operations Controller */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <History size={16} className="text-warning" />
              عمليات وتعديل حالة العقد
            </h3>

            <div className="flex flex-col gap-4">
              <div className="form-control w-full">
                <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">ملاحظات وسبب العملية</span>
                <input
                  type="text"
                  placeholder="اكتب ملاحظة أو سبب تعديل الحالة هنا..."
                  className="input input-bordered w-full bg-base-200 text-xs h-10 min-h-0"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {rental.status === 'draft' && (
                <div className="form-control w-full">
                  <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">قيمة التأمين المدفوعة (فلس)</span>
                  <input
                    type="number"
                    placeholder="التأمين بالفلس..."
                    className="input input-bordered w-full bg-base-200 text-xs h-10 min-h-0"
                    value={depositAmountFils}
                    onChange={(e) => setDepositAmountFils(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {rental.status === 'draft' && can(PERMISSION.RENTAL_CHECKOUT) && (
                  <button onClick={handleCheckout} className="btn btn-success btn-sm gap-1 text-xs">
                    <CheckCircle size={14} />
                    تسليم القطع وتفعيل العقد
                  </button>
                )}

                {rental.status === 'active' && can(PERMISSION.RENTAL_RETURN) && (
                  <button onClick={handleReturn} className="btn btn-warning btn-sm gap-1 text-xs text-black font-bold">
                    <Undo size={14} />
                    بدء عملية الإرجاع
                  </button>
                )}

                {rental.status === 'return_pending' && can(PERMISSION.RENTAL_RETURN) && (
                  <button onClick={handleComplete} className="btn btn-primary btn-sm gap-1 text-xs">
                    <CheckCircle size={14} />
                    إكمال وإغلاق العقد
                  </button>
                )}

                {(rental.status === 'draft' || rental.status === 'checked_out') && can(PERMISSION.RENTAL_CANCEL) && (
                  <button onClick={handleCancel} className="btn btn-error btn-sm gap-1 text-xs">
                    <XCircle size={14} />
                    إلغاء عقد التأجير
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
