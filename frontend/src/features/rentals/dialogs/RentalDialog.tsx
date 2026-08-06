import { useState } from 'react'
import { RentalForm } from '../forms/RentalForm'
import type { CreateRentalPayload } from '../api/api'
import { useCreateRental } from '../hooks/useRentals'

interface RentalDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function RentalDialog({ isOpen, onClose }: RentalDialogProps) {
  const createRental = useCreateRental()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const busy = createRental.isPending

  const handleSubmit = async (payload: CreateRentalPayload) => {
    setError(null)
    try {
      await createRental.mutateAsync(payload)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إنشاء عقد التأجير.')
    }
  }

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-2xl">
        <h3 className="text-lg font-bold mb-4 text-base-content">
          إنشاء عقد تأجير جديد
        </h3>

        <RentalForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          busy={busy}
          error={error}
        />
      </div>
    </div>
  )
}
