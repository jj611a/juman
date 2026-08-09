import { useEffect, useRef, useState } from 'react'
import { InventoryForm } from '../forms/InventoryForm'
import type { CreateItemPayload, ItemDto } from '../api/api'
import { useCreateItem, useUpdateItem } from '../hooks/useInventory'
import { X } from 'lucide-react'

interface InventoryDialogProps {
  isOpen: boolean
  onClose: () => void
  item?: ItemDto | null
}

function toInitialValues(item: ItemDto | null | undefined): CreateItemPayload | undefined {
  if (!item) return undefined
  return {
    displayName: item.displayName,
    categoryId: item.category?.id ?? undefined,
    brandId: item.brand?.id ?? undefined,
    colorId: item.color?.id ?? undefined,
    sizeId: item.size?.id ?? undefined,
    purchasePrice: item.purchasePrice ?? undefined,
    rentalPrice: item.rentalPrice ?? undefined,
    salePrice: item.salePrice ?? undefined,
    status: item.status as CreateItemPayload['status'],
    condition: item.condition as CreateItemPayload['condition'],
    description: item.description ?? undefined,
  }
}

export function InventoryDialog({ isOpen, onClose, item }: InventoryDialogProps) {
  const createItem = useCreateItem()
  const updateItem = useUpdateItem(item?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const isEdit = Boolean(item)
  const busy = createItem.isPending || updateItem.isPending

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setError(null)
      closeRef.current?.focus()
    }
  }, [isOpen])

  const handleSubmit = async (payload: CreateItemPayload) => {
    setError(null)
    try {
      if (isEdit && item) {
        await updateItem.mutateAsync(payload)
      } else {
        await createItem.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ بيانات القطعة.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      dir="rtl"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="modal-box max-h-[88vh] w-full max-w-2xl border border-base-content/10 bg-base-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-base-content">
            {isEdit ? 'تعديل بيانات قطعة المخزون' : 'إضافة قطعة مخزون جديدة'}
          </h3>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-6rem)] overflow-y-auto">
          <InventoryForm
            initialValues={toInitialValues(item)}
            onSubmit={handleSubmit}
            onCancel={onClose}
            busy={busy}
            error={error}
          />
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="إغلاق النافذة">close</button>
      </form>
    </dialog>
  )
}
