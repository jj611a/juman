import { useState } from 'react'
import { CustomerForm } from '../forms/CustomerForm'
import type { CreateCustomerPayload, CustomerDto } from '../api/api'
import { useCreateCustomer, useUpdateCustomer } from '../hooks/useCustomers'

interface CustomerDialogProps {
  isOpen: boolean
  onClose: () => void
  customer?: CustomerDto | null
}

export function CustomerDialog({ isOpen, onClose, customer }: CustomerDialogProps) {
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer(customer?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isEdit = Boolean(customer)
  const busy = createCustomer.isPending || updateCustomer.isPending

  const handleSubmit = async (payload: CreateCustomerPayload) => {
    setError(null)
    try {
      if (isEdit && customer) {
        await updateCustomer.mutateAsync(payload)
      } else {
        await createCustomer.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حفظ بيانات العميل.')
    }
  }

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-2xl">
        <h3 className="text-lg font-bold mb-4 text-base-content">
          {isEdit ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
        </h3>
        
        <CustomerForm
          initialValues={customer ? {
            fullName: customer.fullName,
            phone: customer.phone,
            secondaryPhone: customer.secondaryPhone ?? undefined,
            address: customer.address ?? undefined,
            city: customer.city ?? undefined,
            nationalId: customer.nationalId ?? undefined,
            gender: customer.gender ?? undefined,
            birthDate: customer.birthDate ?? undefined,
            notes: customer.notes ?? undefined,
            status: customer.status
          } : undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
          busy={busy}
          error={error}
        />
      </div>
    </div>
  )
}
