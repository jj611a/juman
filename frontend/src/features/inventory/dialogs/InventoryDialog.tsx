import { useState } from 'react'
import { InventoryForm } from '../forms/InventoryForm'
import type { CreateItemPayload, ItemDto } from '../api/api'
import { useCreateItem, useUpdateItem } from '../hooks/useInventory'

interface InventoryDialogProps {
  isOpen: boolean
  onClose: () => void
  item?: ItemDto | null
}

export function InventoryDialog({ isOpen, onClose, item }: InventoryDialogProps) {
  const createItem = useCreateItem()
  const updateItem = useUpdateItem(item?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isEdit = Boolean(item)
  const busy = createItem.isPending || updateItem.isPending

  const handleSubmit = async (payload: CreateItemPayload) => {
    setError(null)
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync(payload)
      } else {
        await createItem.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حفظ بيانات القطعة.')
    }
  }

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-2xl">
        <h3 className="text-lg font-bold mb-4 text-base-content">
          {isEdit ? 'تعديل بيانات قطعة المخزون' : 'إضافة قطعة مخزون جديدة'}
        </h3>

        <InventoryForm
          initialValues={item ? {
            displayName: item.displayName,
            categoryId: item.categoryId ?? undefined,
            brandId: item.brandId ?? undefined,
            colorId: item.colorId ?? undefined,
            sizeId: item.sizeId ?? undefined,
            purchasePrice: item.purchasePrice ?? undefined,
            rentalPrice: item.rentalPrice ?? undefined,
            salePrice: item.salePrice ?? undefined,
            status: item.status,
            condition: item.condition
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
