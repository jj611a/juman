import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { 
  useReservationDetail, 
  useCheckoutReservation, 
  useCancelReservation, 
  useExpireReservation 
} from '../hooks/useReservations'
import { 
  ChevronRight, 
  User, 
  Phone, 
  Calendar, 
  Shirt, 
  Info,
  AlertTriangle,
  Play,
  XOctagon,
  Hourglass
} from 'lucide-react'

// Formatting helper for Fils to AED
function formatFils(fils: number | null | undefined): string {
  if (!fils) return '— د.إ'
  return `${(fils / 1000).toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`
}

export function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermission()

  // Queries
  const { data: res, isLoading, isError } = useReservationDetail(id ?? '')

  // Mutations
  const checkoutMut = useCheckoutReservation(id ?? '')
  const cancelMut = useCancelReservation(id ?? '')
  const expireMut = useExpireReservation(id ?? '')

  // Action fields state
  const [reason, setReason] = useState('')
  const [deposit, setDeposit] = useState('0')

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" dir="rtl">
        <span className="loading loading-spinner text-primary loading-lg" />
      </div>
    )
  }

  if (isError || !res) {
    return (
      <div className="alert alert-error text-sm max-w-lg mx-auto mt-8 flex gap-2" dir="rtl">
        <AlertTriangle size={18} />
        <span>تعذر تحميل تفاصيل الحجز المطلوبة.</span>
      </div>
    )
  }

  const handleCheckout = async () => {
    const ok = window.confirm('هل تريد تأكيد تسليم القطع (Checkout) وتفعيل عقد التأجير؟')
    if (!ok) return
    try {
      const depFils = Math.round(Number(deposit) * 1000)
      await checkoutMut.mutateAsync({ reason: reason || undefined, depositAmountFils: depFils })
      alert('تم التسليم بنجاح وتفعيل عقد التأجير.')
      setReason('')
    } catch (err: any) {
      alert(err?.message || 'فشل عملية التسليم.')
    }
  }

  const handleCancel = async () => {
    const ok = window.confirm('هل أنت متأكد من إلغاء الحجز؟')
    if (!ok) return
    try {
      await cancelMut.mutateAsync(reason || undefined)
      alert('تم إلغاء الحجز.')
      setReason('')
    } catch (err: any) {
      alert(err?.message || 'فشل إلغاء الحجز.')
    }
  }

  const handleExpire = async () => {
    const ok = window.confirm('هل تريد إنهاء صلاحية هذا الحجز؟')
    if (!ok) return
    try {
      await expireMut.mutateAsync(reason || undefined)
      alert('تم إنهاء صلاحية الحجز.')
      setReason('')
    } catch (err: any) {
      alert(err?.message || 'فشل إنهاء الحجز.')
    }
  }

  return (
    <div className="space-y-6 select-none text-sm" dir="rtl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-base-content/50 border-b border-base-content/5 pb-4">
        <button onClick={() => navigate('/reservations')} className="hover:text-primary transition-colors">
          سجل الحجوزات
        </button>
        <ChevronRight size={14} />
        <span className="font-bold text-base-content">{res.reservationNumber}</span>
      </div>

      {/* Reservation Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-base-300/40 p-6 rounded-2xl border border-base-content/5">
        <div className="avatar placeholder">
          <div className="bg-primary/20 text-primary w-24 h-24 rounded-xl border border-primary/30 flex items-center justify-center">
            <Calendar size={48} className="text-primary/70" />
          </div>
        </div>
        <div className="flex-1 text-center md:text-right space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl font-black text-base-content">طلب حجز {res.reservationNumber}</h1>
            <span className="badge badge-neutral badge-xs font-mono py-2">{res.status}</span>
          </div>
          <p className="text-xs text-base-content/40 font-mono">ID: {res.id}</p>
          <p className="text-xs text-base-content/50">تم الإنشاء في: {new Date(res.createdAt).toLocaleString('ar-AE')}</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Customer & Date Specification Summary */}
        <div className="space-y-6">
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <User size={16} className="text-primary" />
              العميل المحجوز له
            </h3>
            {res.customer ? (
              <div className="text-xs space-y-2">
                <p className="font-bold text-sm">{res.customer.fullName}</p>
                <p className="font-mono text-base-content/50 flex items-center gap-1.5"><Phone size={12} /> {res.customer.phone}</p>
              </div>
            ) : (
              <p className="text-xs text-base-content/40 italic">لا توجد بيانات عميل ملحقة</p>
            )}
          </div>

          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <Calendar size={16} className="text-primary" />
              التواريخ والجدولة الزمنية
            </h3>
            <div className="text-xs space-y-3">
              <div className="flex justify-between">
                <span className="text-base-content/50">تاريخ الحجز</span>
                <span className="font-semibold">{new Date(res.startDate).toLocaleDateString('ar-AE')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">الاستلام المتوقع</span>
                <span className="font-semibold">{new Date(res.expectedCheckoutDate).toLocaleDateString('ar-AE')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">الإرجاع المتوقع</span>
                <span className="font-semibold">{new Date(res.expectedReturnDate).toLocaleDateString('ar-AE')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items list & transition actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reserved Items List */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2 border-b border-base-content/5 pb-2">
              <Shirt size={16} className="text-primary" />
              القطع الفنية المحجوزة
            </h3>
            {(!res.items || res.items.length === 0) ? (
              <p className="text-xs text-base-content/40 italic">لا توجد قطع مضافة لهذا الحجز</p>
            ) : (
              <div className="space-y-3">
                {res.items.map((it) => (
                  <div key={it.itemId} className="flex justify-between items-center bg-base-200/50 p-3 rounded-lg border border-base-content/5">
                    <div>
                      <p className="font-bold text-xs">{it.item?.displayName || 'قطعة مخزون'}</p>
                      <p className="font-mono text-[10px] text-base-content/40 mt-0.5">{it.item?.internalCode || 'Code'}</p>
                    </div>
                    <span className="font-bold text-primary">{formatFils(it.agreedRentalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action state transitions (Checkout, Cancel, Expire) */}
          {(res.status === 'confirmed' || res.status === 'draft') && (
            <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 space-y-4">
              <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2">
                <Info size={16} className="text-primary" />
                خيارات وإجراءات تعديل حالة الحجز
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control w-full">
                  <span className="label-text mb-1 text-xs text-base-content/50">السبب (للالغاء أو التسليم)</span>
                  <input
                    type="text"
                    className="input input-bordered w-full bg-base-200 text-xs h-9 min-h-0"
                    placeholder="اكتب ملاحظة أو سبب التعديل..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {res.status === 'confirmed' && (
                  <div className="form-control w-full">
                    <span className="label-text mb-1 text-xs text-base-content/50">مبلغ التأمين المستلم (AED)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input input-bordered w-full bg-base-200 text-xs h-9 min-h-0"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {res.status === 'confirmed' && can(PERMISSION.RESERVATION_CHECKOUT) && (
                  <button
                    onClick={() => void handleCheckout()}
                    className="btn btn-primary btn-sm gap-2 font-bold"
                  >
                    <Play size={12} />
                    تسليم للعميل (Checkout)
                  </button>
                )}
                {can(PERMISSION.RESERVATION_CANCEL) && (
                  <button
                    onClick={() => void handleCancel()}
                    className="btn btn-error btn-sm btn-outline gap-2"
                  >
                    <XOctagon size={12} />
                    إلغاء الطلب
                  </button>
                )}
                {can(PERMISSION.RESERVATION_EXPIRE) && (
                  <button
                    onClick={() => void handleExpire()}
                    className="btn btn-ghost btn-sm btn-outline gap-2"
                  >
                    <Hourglass size={12} />
                    إنهاء الصلاحية
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
