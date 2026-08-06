import { useState, useEffect } from 'react'
import type { CreateRentalPayload } from '../api/api'
import { useCustomersList } from '@/features/customers/hooks/useCustomers'
import { useItemsList } from '@/features/inventory/hooks/useInventory'

interface RentalFormProps {
  onSubmit: (values: CreateRentalPayload) => void | Promise<void>
  onCancel: () => void
  busy?: boolean
  error?: string | null
}

export function RentalForm({
  onSubmit,
  onCancel,
  busy = false,
  error = null
}: RentalFormProps) {
  const [customerId, setCustomerId] = useState('')
  const [rentalDate, setRentalDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [notes, setNotes] = useState('')

  // Item selection states
  const [selectedItems, setSelectedItems] = useState<Array<{ itemId: string; name: string; price: number }>>([])
  const [currentItemId, setCurrentItemId] = useState('')

  // API Lists
  const { data: customersData } = useCustomersList({ limit: 100 })
  const { data: itemsData } = useItemsList({ limit: 100 })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (customerId || notes || selectedItems.length > 0) {
      setHasChanges(true)
    }
  }, [customerId, notes, selectedItems])

  const handleAddItem = () => {
    if (!currentItemId) return
    const matched = (itemsData?.data || []).find((i) => i.id === currentItemId)
    if (matched) {
      if (selectedItems.some((i) => i.itemId === matched.id)) return
      setSelectedItems([
        ...selectedItems,
        { itemId: matched.id, name: matched.displayName, price: matched.rentalPrice ?? 0 }
      ])
      setCurrentItemId('')
    }
  }

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.itemId !== itemId))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customerId = 'العميل مطلوب'
    if (!rentalDate) errs.rentalDate = 'تاريخ التأجير مطلوب'
    if (!expectedReturnDate) errs.expectedReturnDate = 'تاريخ الإرجاع المتوقع مطلوب'
    if (selectedItems.length === 0) errs.items = 'يجب إضافة قطعة واحدة على الأقل'

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload: CreateRentalPayload = {
      customerId,
      rentalDate: new Date(rentalDate).toISOString(),
      expectedReturnDate: new Date(expectedReturnDate).toISOString(),
      notes: notes.trim() || undefined,
      items: selectedItems.map((item) => ({
        itemId: item.itemId,
        agreedRentalPrice: item.price
      }))
    }
    void onSubmit(payload)
  }

  const handleCancelClick = () => {
    if (hasChanges) {
      const confirmLeave = window.confirm('لديك تغييرات غير محفوظة، هل أنت متأكد من المغادرة؟')
      if (!confirmLeave) return
    }
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm" dir="rtl">
      {error && (
        <div className="alert alert-error text-xs p-3">
          <span>{error}</span>
        </div>
      )}

      {/* Customer Selector */}
      <div className="form-control w-full">
        <span className="label-text mb-1 text-xs font-semibold">اختر العميل *</span>
        <select
          className={`select select-bordered w-full bg-base-300 ${validationErrors.customerId ? 'border-error' : ''}`}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          disabled={busy}
          required
        >
          <option value="">اختر عميل...</option>
          {(customersData?.data || []).map((c) => (
            <option key={c.id} value={c.id}>{c.fullName} ({c.phone})</option>
          ))}
        </select>
        {validationErrors.customerId && (
          <span className="text-[10px] text-error mt-1">{validationErrors.customerId}</span>
        )}
      </div>

      {/* Item Multiselection Selector */}
      <div className="form-control w-full p-4 border border-base-content/10 rounded-xl bg-base-300/40">
        <span className="label-text mb-2 text-xs font-bold text-base-content/60">القطع المستأجرة *</span>
        <div className="flex gap-2">
          <select
            className="select select-bordered flex-1 bg-base-300 text-xs"
            value={currentItemId}
            onChange={(e) => setCurrentItemId(e.target.value)}
            disabled={busy}
          >
            <option value="">اختر قطعة لإضافتها للتأجير...</option>
            {(itemsData?.data || [])
              .filter((i) => !selectedItems.some((sel) => sel.itemId === i.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName} ({item.internalCode})
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={handleAddItem}
            className="btn btn-outline btn-sm font-bold text-xs"
            disabled={busy}
          >
            إضافة
          </button>
        </div>
        {validationErrors.items && (
          <span className="text-[10px] text-error mt-1.5">{validationErrors.items}</span>
        )}

        {/* Selected Items List */}
        {selectedItems.length > 0 && (
          <div className="mt-3 space-y-2">
            {selectedItems.map((item) => (
              <div key={item.itemId} className="flex justify-between items-center bg-base-200/50 p-2 rounded-lg text-xs">
                <span>{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary">{(item.price / 1000).toLocaleString('ar-AE')} د.إ</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.itemId)}
                    className="text-error font-bold hover:underline"
                    disabled={busy}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dates Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold">تاريخ التأجير *</span>
          <input
            type="date"
            className={`input input-bordered w-full bg-base-300 ${validationErrors.rentalDate ? 'border-error' : ''}`}
            value={rentalDate}
            onChange={(e) => setRentalDate(e.target.value)}
            disabled={busy}
            required
          />
          {validationErrors.rentalDate && (
            <span className="text-[10px] text-error mt-1">{validationErrors.rentalDate}</span>
          )}
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold">تاريخ الإرجاع المتوقع *</span>
          <input
            type="date"
            className={`input input-bordered w-full bg-base-300 ${validationErrors.expectedReturnDate ? 'border-error' : ''}`}
            value={expectedReturnDate}
            onChange={(e) => setExpectedReturnDate(e.target.value)}
            disabled={busy}
            required
          />
          {validationErrors.expectedReturnDate && (
            <span className="text-[10px] text-error mt-1">{validationErrors.expectedReturnDate}</span>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="form-control w-full">
        <span className="label-text mb-1 text-xs font-semibold">ملاحظات العقد</span>
        <textarea
          className="textarea textarea-bordered w-full bg-base-300 h-16"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="submit"
          className="btn btn-primary btn-sm px-6 font-bold"
          disabled={busy}
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : 'إنشاء عقد تأجير'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm px-6"
          onClick={handleCancelClick}
          disabled={busy}
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}
