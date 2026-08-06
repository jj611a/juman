import { useState, useEffect } from 'react'
import type { CreateItemPayload } from '../api/api'
import { useCategories, useBrands, useColors, useSizes } from '../hooks/useInventory'

interface InventoryFormProps {
  initialValues?: CreateItemPayload
  onSubmit: (values: CreateItemPayload) => void | Promise<void>
  onCancel: () => void
  busy?: boolean
  error?: string | null
}

export function InventoryForm({
  initialValues,
  onSubmit,
  onCancel,
  busy = false,
  error = null
}: InventoryFormProps) {
  const [displayName, setDisplayName] = useState(initialValues?.displayName ?? '')
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '')
  const [brandId, setBrandId] = useState(initialValues?.brandId ?? '')
  const [colorId, setColorId] = useState(initialValues?.colorId ?? '')
  const [sizeId, setSizeId] = useState(initialValues?.sizeId ?? '')
  const [purchasePrice, setPurchasePrice] = useState(initialValues?.purchasePrice ? String(initialValues.purchasePrice / 1000) : '')
  const [rentalPrice, setRentalPrice] = useState(initialValues?.rentalPrice ? String(initialValues.rentalPrice / 1000) : '')
  const [salePrice, setSalePrice] = useState(initialValues?.salePrice ? String(initialValues.salePrice / 1000) : '')
  const [status, setStatus] = useState(initialValues?.status ?? 'active')
  const [condition, setCondition] = useState(initialValues?.condition ?? 'NEW')

  // Taxonomy queries
  const { data: categories = [] } = useCategories()
  const { data: brands = [] } = useBrands()
  const { data: colors = [] } = useColors()
  const { data: sizes = [] } = useSizes()

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (!initialValues) {
      if (displayName || categoryId || brandId || purchasePrice || rentalPrice) {
        setHasChanges(true)
      }
    } else {
      const changed =
        displayName !== (initialValues.displayName ?? '') ||
        categoryId !== (initialValues.categoryId ?? '') ||
        brandId !== (initialValues.brandId ?? '') ||
        colorId !== (initialValues.colorId ?? '') ||
        sizeId !== (initialValues.sizeId ?? '') ||
        purchasePrice !== (initialValues.purchasePrice ? String(initialValues.purchasePrice / 1000) : '') ||
        rentalPrice !== (initialValues.rentalPrice ? String(initialValues.rentalPrice / 1000) : '') ||
        salePrice !== (initialValues.salePrice ? String(initialValues.salePrice / 1000) : '') ||
        status !== (initialValues.status ?? 'active') ||
        condition !== (initialValues.condition ?? 'NEW')
      setHasChanges(changed)
    }
  }, [displayName, categoryId, brandId, colorId, sizeId, purchasePrice, rentalPrice, salePrice, status, condition, initialValues])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'اسم القطعة مطلوب'

    const numRent = Number(rentalPrice)
    const numSale = Number(salePrice)
    const numPurchase = Number(purchasePrice)

    if (rentalPrice.trim() && (isNaN(numRent) || numRent < 0)) errs.rentalPrice = 'سعر الإيجار غير صالح'
    if (salePrice.trim() && (isNaN(numSale) || numSale < 0)) errs.salePrice = 'سعر البيع غير صالح'
    if (purchasePrice.trim() && (isNaN(numPurchase) || numPurchase < 0)) errs.purchasePrice = 'سعر الشراء غير صالح'

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const payload: CreateItemPayload = {
      displayName: displayName.trim(),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(colorId ? { colorId } : {}),
      ...(sizeId ? { sizeId } : {}),
      ...(purchasePrice ? { purchasePrice: Math.round(Number(purchasePrice) * 1000) } : {}),
      ...(rentalPrice ? { rentalPrice: Math.round(Number(rentalPrice) * 1000) } : {}),
      ...(salePrice ? { salePrice: Math.round(Number(salePrice) * 1000) } : {}),
      status,
      condition
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

      {/* Name */}
      <div className="form-control w-full">
        <span className="label-text mb-1 text-xs font-semibold">اسم القطعة (العرض) *</span>
        <input
          type="text"
          className={`input input-bordered w-full bg-base-300 ${validationErrors.displayName ? 'border-error' : ''}`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
          required
        />
        {validationErrors.displayName && (
          <span className="text-[10px] text-error mt-1">{validationErrors.displayName}</span>
        )}
      </div>

      {/* Category and Brand */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">التصنيف (القسم)</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={busy}
          >
            <option value="">اختر التصنيف...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">العلامة التجارية (البراند)</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={busy}
          >
            <option value="">اختر الماركة...</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Color and Size */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">اللون</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={colorId}
            onChange={(e) => setColorId(e.target.value)}
            disabled={busy}
          >
            <option value="">اختر اللون...</option>
            {colors.map((col) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">المقاس</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={sizeId}
            onChange={(e) => setSizeId(e.target.value)}
            disabled={busy}
          >
            <option value="">اختر المقاس...</option>
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pricing Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">سعر الإيجار (AED)</span>
          <input
            type="number"
            step="0.01"
            className="input input-bordered w-full bg-base-300"
            value={rentalPrice}
            onChange={(e) => setRentalPrice(e.target.value)}
            disabled={busy}
          />
          {validationErrors.rentalPrice && (
            <span className="text-[10px] text-error mt-1">{validationErrors.rentalPrice}</span>
          )}
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">سعر البيع (AED)</span>
          <input
            type="number"
            step="0.01"
            className="input input-bordered w-full bg-base-300"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            disabled={busy}
          />
          {validationErrors.salePrice && (
            <span className="text-[10px] text-error mt-1">{validationErrors.salePrice}</span>
          )}
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">سعر التكلفة / الشراء (AED)</span>
          <input
            type="number"
            step="0.01"
            className="input input-bordered w-full bg-base-300"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            disabled={busy}
          />
          {validationErrors.purchasePrice && (
            <span className="text-[10px] text-error mt-1">{validationErrors.purchasePrice}</span>
          )}
        </div>
      </div>

      {/* Status & Condition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">الحالة في الكتالوج</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={busy}
          >
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1 text-xs">حالة القطعة الفنية</span>
          <select
            className="select select-bordered w-full bg-base-300"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            disabled={busy}
          >
            <option value="NEW">جديد (New)</option>
            <option value="EXCELLENT">ممتاز (Excellent)</option>
            <option value="GOOD">جيد جداً (Good)</option>
            <option value="FAIR">مستعمل (Fair)</option>
            <option value="DAMAGED">تالف (Damaged)</option>
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="submit"
          className="btn btn-primary btn-sm px-6 font-bold"
          disabled={busy}
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : 'حفظ القطعة'}
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
