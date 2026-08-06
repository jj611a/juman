import { useItemAvailability } from '../hooks/useInventory'
import { CalendarCheck, CalendarX, Clock, User, AlertTriangle } from 'lucide-react'

interface AvailabilityPanelProps {
  itemId: string
}

export function AvailabilityPanel({ itemId }: AvailabilityPanelProps) {
  const { data, isLoading, isError } = useItemAvailability(itemId)

  if (isLoading) {
    return (
      <div className="h-24 w-full bg-base-300/40 rounded-xl animate-pulse" />
    )
  }

  if (isError || !data) {
    return (
      <div className="alert alert-error text-xs p-3 flex gap-2" dir="rtl">
        <AlertTriangle size={14} />
        <span>تعذر تحميل حالة توفر القطعة.</span>
      </div>
    )
  }

  const { isAvailable, lifecycleState, reason, nextAvailableDate, currentHolder } = data

  return (
    <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-5 text-xs space-y-3" dir="rtl">
      <div className="flex justify-between items-center">
        <span className="font-bold text-base-content/70">حالة توفر القطعة</span>
        {isAvailable ? (
          <span className="badge badge-success gap-1 font-bold py-2.5 px-3">
            <CalendarCheck size={12} />
            متاح ✓
          </span>
        ) : (
          <span className="badge badge-error gap-1 font-bold py-2.5 px-3">
            <CalendarX size={12} />
            غير متاح ✗
          </span>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-base-content/5">
        <div className="flex justify-between text-base-content/60">
          <span>دورة الحياة:</span>
          <span className="font-bold text-base-content">{lifecycleState}</span>
        </div>

        {!isAvailable && (
          <>
            {reason && (
              <div className="flex justify-between text-base-content/60">
                <span>سبب عدم التوفر:</span>
                <span className="font-bold text-warning">
                  {reason === 'reserved' ? 'محجوز لعميل آخر' : reason === 'rented' ? 'مستأجر حالياً' : reason}
                </span>
              </div>
            )}

            {currentHolder && (
              <div className="flex justify-between text-base-content/60">
                <span>الحائز الحالي:</span>
                <span className="font-bold text-base-content flex items-center gap-1">
                  <User size={12} />
                  {currentHolder.fullName}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base-content/60">
              <span>تاريخ التوفر التالي المتوقع:</span>
              <span className="font-mono font-bold text-primary flex items-center gap-1">
                <Clock size={12} />
                {new Date(nextAvailableDate).toLocaleDateString('ar-AE')}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
