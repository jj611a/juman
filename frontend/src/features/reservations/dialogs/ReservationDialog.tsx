import { useState } from 'react'
import { ReservationForm } from '../forms/ReservationForm'
import type { CreateReservationPayload } from '../api/api'
import { useCreateReservation } from '../hooks/useReservations'

interface ReservationDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ReservationDialog({ isOpen, onClose }: ReservationDialogProps) {
  const createReservation = useCreateReservation()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const busy = createReservation.isPending

  const handleSubmit = async (payload: CreateReservationPayload) => {
    setError(null)
    try {
      await createReservation.mutateAsync(payload)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إنشاء الحجز.')
    }
  }

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-2xl">
        <h3 className="text-lg font-bold mb-4 text-base-content">
          إنشاء حجز قطعة مخزون جديد
        </h3>

        <ReservationForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          busy={busy}
          error={error}
        />
      </div>
    </div>
  )
}
