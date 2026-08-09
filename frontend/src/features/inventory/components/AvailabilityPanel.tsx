import { useItemAvailability } from '../hooks/useInventory'
import { CalendarCheck, CalendarX, Clock, User, AlertTriangle } from 'lucide-react'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { LIFECYCLE_LABELS } from '../constants/inventory'

interface AvailabilityPanelProps {
  itemId: string
}

export function AvailabilityPanel({ itemId }: AvailabilityPanelProps) {
  const { can } = usePermission()
  const { data, isLoading, isError } = useItemAvailability(itemId)

  if (isLoading) {
    return (
      <div className="h-24 w-full animate-pulse rounded-box bg-base-300/40" aria-busy="true" />
    )
  }

  if (isError || !data) {
    return (
      <div className="alert alert-error text-xs p-3" dir="rtl">
        <AlertTriangle size={14} />
        <span>تعذر تحميل حالة توفر القطعة.</span>
      </div>
    )
  }

  const { isAvailable, lifecycleState, reason, nextAvailableDate, currentHolder } = data

  return (
    <div className="card border border-base-content/10 bg-base-300/80 p-5 text-xs shadow" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="font-bold text-base-content/70">حالة التوفر</span>
        {can(PERMISSION.AVAILABILITY_VIEW) ? (
          isAvailable ? (
            <span className="badge badge-success gap-1 font-bold">
              <CalendarCheck size={12} />
              متاح
            </span>
          ) : (
            <span className="badge badge-error gap-1 font-bold">
              <CalendarX size={12} />
              غير متاح
            </span>
          )
        ) : (
          <span className="badge badge-ghost">—</span>
        )}
      </div>

      <div className="mt-3 space-y-2 border-t border-base-content/5 pt-3">
        <div className="flex justify-between text-base-content/60">
          <span>دورة الحياة:</span>
          <span className="font-bold text-base-content">
            {LIFECYCLE_LABELS[lifecycleState as keyof typeof LIFECYCLE_LABELS] ?? lifecycleState}
          </span>
        </div>

        {!isAvailable && (
          <>
            {reason && (
              <div className="flex justify-between text-base-content/60">
                <span>سبب عدم التوفر:</span>
                <span className="font-bold text-warning">
                  {reason === 'reserved'
                    ? 'محجوز لعميل آخر'
                    : reason === 'rented'
                      ? 'مستأجر حالياً'
                      : LIFECYCLE_LABELS[reason as keyof typeof LIFECYCLE_LABELS] ?? reason}
                </span>
              </div>
            )}

            {currentHolder && (
              <div className="flex justify-between text-base-content/60">
                <span>الحائز الحالي:</span>
                <span className="flex items-center gap-1 font-bold text-base-content">
                  <User size={12} />
                  {currentHolder.fullName}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base-content/60">
              <span>متاح مجدداً بعد:</span>
              <span className="flex items-center gap-1 font-mono font-bold text-primary">
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
