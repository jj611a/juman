import { useEffect, useMemo, useState } from 'react'
import type { CreateItemPayload } from '../api/api'
import {
  useCategories,
  useBrands,
  useColors,
  useSizes,
  useCreateTaxonomy,
  useMediaUpload,
  type TaxonomyKind,
} from '../hooks/useInventory'
import { STATUS_OPTIONS, CONDITION_OPTIONS } from '../constants/inventory'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { Plus, X, Image as ImageIcon, Upload, Trash2, Check } from 'lucide-react'

interface InventoryFormProps {
  initialValues?: CreateItemPayload
  onSubmit: (values: CreateItemPayload) => void | Promise<void>
  onCancel: () => void
  busy?: boolean
  error?: string | null
}

const TAXONOMY_LABEL: Record<TaxonomyKind, string> = {
  category: 'التصنيف',
  brand: 'البراند',
  color: 'اللون',
  size: 'المقاس',
}

const TAXONOMY_PERMISSION: Record<TaxonomyKind, string> = {
  category: PERMISSION.CATEGORIES_CREATE,
  brand: PERMISSION.INVENTORY_BRANDS_CREATE,
  color: PERMISSION.INVENTORY_COLORS_CREATE,
  size: PERMISSION.INVENTORY_SIZES_CREATE,
}

export function InventoryForm({
  initialValues,
  onSubmit,
  onCancel,
  busy = false,
  error = null,
}: InventoryFormProps) {
  const { can } = usePermission()

  const [displayName, setDisplayName] = useState(initialValues?.displayName ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '')
  const [brandId, setBrandId] = useState(initialValues?.brandId ?? '')
  const [colorId, setColorId] = useState(initialValues?.colorId ?? '')
  const [sizeId, setSizeId] = useState(initialValues?.sizeId ?? '')
  const [purchasePrice, setPurchasePrice] = useState(
    initialValues?.purchasePrice != null ? String(initialValues.purchasePrice / 1000) : '',
  )
  const [rentalPrice, setRentalPrice] = useState(
    initialValues?.rentalPrice != null ? String(initialValues.rentalPrice / 1000) : '',
  )
  const [salePrice, setSalePrice] = useState(
    initialValues?.salePrice != null ? String(initialValues.salePrice / 1000) : '',
  )
  const [status, setStatus] = useState(initialValues?.status ?? 'active')
  const [condition, setCondition] = useState(initialValues?.condition ?? 'good')
  const [barcode, setBarcode] = useState(initialValues?.barcode ?? '')
  const [generateBarcode, setGenerateBarcode] = useState(initialValues?.generateBarcode ?? false)

  // Media upload state
  const [pendingMedia, setPendingMedia] = useState<Array<{
    id: string
    file: File
    mediaFileId?: string
    isPrimary?: boolean
    displayOrder?: number
    status: 'pending' | 'uploading' | 'done' | 'error'
    error?: string
  }>>([])
  const mediaUpload = useMediaUpload()

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const { data: categories = { items: [] } } = useCategories()
  const { data: brands = { items: [] } } = useBrands()
  const { data: colors = { items: [] } } = useColors()
  const { data: sizes = { items: [] } } = useSizes()

  const createCategory = useCreateTaxonomy('category')
  const createBrand = useCreateTaxonomy('brand')
  const createColor = useCreateTaxonomy('color')
  const createSize = useCreateTaxonomy('size')

  const [quickAdd, setQuickAdd] = useState<{
    kind: TaxonomyKind
    name: string
    hexCode?: string
  } | null>(null)
  const quickMutation = useMemo(() => {
    switch (quickAdd?.kind) {
      case 'category':
        return createCategory
      case 'brand':
        return createBrand
      case 'color':
        return createColor
      case 'size':
        return createSize
      default:
        return null
    }
  }, [quickAdd, createCategory, createBrand, createColor, createSize])

  const hasChanges = useMemo(() => {
    const changed =
      displayName !== (initialValues?.displayName ?? '') ||
      description !== (initialValues?.description ?? '') ||
      categoryId !== (initialValues?.categoryId ?? '') ||
      brandId !== (initialValues?.brandId ?? '') ||
      colorId !== (initialValues?.colorId ?? '') ||
      sizeId !== (initialValues?.sizeId ?? '') ||
      purchasePrice !== (initialValues?.purchasePrice != null ? String(initialValues.purchasePrice / 1000) : '') ||
      rentalPrice !== (initialValues?.rentalPrice != null ? String(initialValues.rentalPrice / 1000) : '') ||
      salePrice !== (initialValues?.salePrice != null ? String(initialValues.salePrice / 1000) : '') ||
      status !== (initialValues?.status ?? 'active') ||
      condition !== (initialValues?.condition ?? 'good')
    return changed
  }, [displayName, description, categoryId, brandId, colorId, sizeId, purchasePrice, rentalPrice, salePrice, status, condition, initialValues])

  const handleQuickAddSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!quickAdd || !quickAdd.name.trim() || !quickMutation) return
    try {
      const created = await quickMutation.mutateAsync({
        name: quickAdd.name.trim(),
        ...(quickAdd.kind === 'color' && quickAdd.hexCode ? { hexCode: quickAdd.hexCode } : {}),
      })
      const setter = {
        category: setCategoryId,
        brand: setBrandId,
        color: setColorId,
        size: setSizeId,
      }[quickAdd.kind]
      setter(created.id)
      setQuickAdd(null)
    } catch {
      setValidationErrors((prev) => ({ ...prev, quickAdd: 'تعذر إضافة العنصر الجديد.' }))
    }
  }

  // Media upload handlers
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newMedia = files.map((file) => ({
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending' as const,
    }))
    setPendingMedia((prev) => [...prev, ...newMedia])
    // Upload sequentially
    newMedia.forEach((m) => uploadMediaFile(m.id))
  }

  const uploadMediaFile = async (mediaId: string) => {
    setPendingMedia((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, status: 'uploading' as const } : m)),
    )
    try {
      const file = pendingMedia.find((m) => m.id === mediaId)?.file
      if (!file) throw new Error('File not found')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mediaUpload.mutateAsync({
        name: file.name,
        mimeType: file.type,
        buffer: arrayBuffer,
      })
      setPendingMedia((prev) =>
        prev.map((m) =>
          m.id === mediaId ? { ...m, status: 'done' as const, mediaFileId: (result as { id: string }).id } : m,
        ),
      )
    } catch (err) {
      setPendingMedia((prev) =>
        prev.map((m) =>
          m.id === mediaId
            ? { ...m, status: 'error' as const, error: err instanceof Error ? err.message : 'فشل الرفع' }
            : m,
        ),
      )
    }
  }

  const removeMedia = (mediaId: string) => {
    setPendingMedia((prev) => prev.filter((m) => m.id !== mediaId))
  }

  const setPrimaryMedia = (mediaId: string) => {
    setPendingMedia((prev) =>
      prev.map((m) => ({ ...m, isPrimary: m.id === mediaId })),
    )
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'اسم القطعة مطلوب'
    else if (displayName.trim().length > 200) errs.displayName = 'الاسم يجب ألا يتجاوز 200 حرف'

    const numRent = Number(rentalPrice)
    const numSale = Number(salePrice)
    const numPurchase = Number(purchasePrice)

    if (rentalPrice.trim() && (isNaN(numRent) || numRent < 0)) errs.rentalPrice = 'سعر الإيجار غير صالح'
    if (salePrice.trim() && (isNaN(numSale) || numSale < 0)) errs.salePrice = 'سعر البيع غير صالح'
    if (purchasePrice.trim() && (isNaN(numPurchase) || numPurchase < 0)) errs.purchasePrice = 'سعر الشراء غير صالح'

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const mediaArray = pendingMedia
      .filter((m) => m.status === 'done' && m.mediaFileId)
      .map((m, idx) => ({
        mediaFileId: m.mediaFileId!,
        isPrimary: m.isPrimary ?? idx === 0,
        displayOrder: m.displayOrder ?? idx,
      }))

    const payload: CreateItemPayload = {
      displayName: displayName.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(colorId ? { colorId } : {}),
      ...(sizeId ? { sizeId } : {}),
      ...(purchasePrice.trim() ? { purchasePrice: Math.round(Number(purchasePrice) * 1000) } : {}),
      ...(rentalPrice.trim() ? { rentalPrice: Math.round(Number(rentalPrice) * 1000) } : {}),
      ...(salePrice.trim() ? { salePrice: Math.round(Number(salePrice) * 1000) } : {}),
      status: status as CreateItemPayload['status'],
      condition: condition as CreateItemPayload['condition'],
      ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
      generateBarcode,
      ...(mediaArray.length > 0 ? { media: mediaArray } : {}),
    }
    void onSubmit(payload)
  }

  const handleCancelClick = () => {
    if (hasChanges) {
      const ok = window.confirm('لديك تغييرات غير محفوظة، هل أنت متأكد من المغادرة؟')
      if (!ok) return
    }
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm" dir="rtl" noValidate>
      {error && (
        <div className="alert alert-error text-xs p-3">
          <span>{error}</span>
        </div>
      )}

      {/* Name */}
      <div className="form-control w-full">
        <label htmlFor="item-display-name" className="label-text mb-1 text-xs font-semibold">
          اسم القطعة (العرض) *
        </label>
        <input
          id="item-display-name"
          type="text"
          className={`input input-bordered w-full bg-base-300 ${validationErrors.displayName ? 'input-error' : ''}`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
          maxLength={200}
          aria-invalid={Boolean(validationErrors.displayName)}
          aria-describedby={validationErrors.displayName ? 'item-display-name-err' : undefined}
        />
        {validationErrors.displayName && (
          <span id="item-display-name-err" className="mt-1 text-[10px] text-error">
            {validationErrors.displayName}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="form-control w-full">
        <label htmlFor="item-description" className="label-text mb-1 text-xs">
          الوصف
        </label>
        <textarea
          id="item-description"
          className="textarea textarea-bordered w-full bg-base-300"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </div>

      {/* Taxonomy */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TaxonomyField
          label="التصنيف"
          value={categoryId}
          options={categories.items.map((c) => ({ id: c.id, name: c.name }))}
          onChange={setCategoryId}
          disabled={busy}
          canCreate={can(PERMISSION.CATEGORIES_CREATE)}
          onCreate={() => setQuickAdd({ kind: 'category', name: '' })}
        />
        <TaxonomyField
          label="البراند"
          value={brandId}
          options={brands.items.map((b) => ({ id: b.id, name: b.name }))}
          onChange={setBrandId}
          disabled={busy}
          canCreate={can(PERMISSION.CATEGORIES_CREATE)}
          onCreate={() => setQuickAdd({ kind: 'brand', name: '' })}
        />
        <TaxonomyField
          label="اللون"
          value={colorId}
          options={colors.items.map((c) => ({ id: c.id, name: c.name }))}
          onChange={setColorId}
          disabled={busy}
          canCreate={can(PERMISSION.CATEGORIES_CREATE)}
          onCreate={() => setQuickAdd({ kind: 'color', name: '' })}
        />
        <TaxonomyField
          label="المقاس"
          value={sizeId}
          options={sizes.items.map((s) => ({ id: s.id, name: s.name }))}
          onChange={setSizeId}
          disabled={busy}
          canCreate={can(PERMISSION.CATEGORIES_CREATE)}
          onCreate={() => setQuickAdd({ kind: 'size', name: '' })}
        />
      </div>

      {/* Quick add inline */}
      {quickAdd && (
        <div className="rounded-box border border-primary/30 bg-primary/5 p-3" role="group" aria-label={`إضافة ${TAXONOMY_LABEL[quickAdd.kind]} جديد`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">إضافة {TAXONOMY_LABEL[quickAdd.kind]} جديد</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={() => setQuickAdd(null)}
              aria-label="إغلاق"
            >
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleQuickAddSubmit} className="flex flex-wrap items-end gap-2">
            <label className="form-control min-w-40 flex-1">
              <span className="label-text mb-1 text-[10px] text-base-content/50">الاسم</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full bg-base-300"
                value={quickAdd.name}
                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                autoFocus
              />
            </label>
            {quickAdd.kind === 'color' && (
              <label className="form-control">
                <span className="label-text mb-1 text-[10px] text-base-content/50">اللون (Hex)</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-28 bg-base-300 font-mono"
                  placeholder="#RRGGBB"
                  maxLength={7}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  value={quickAdd.hexCode ?? ''}
                  onChange={(e) => setQuickAdd({ ...quickAdd, hexCode: e.target.value })}
                />
              </label>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={quickMutation?.isPending || !quickAdd.name.trim()}>
              {quickMutation?.isPending ? <span className="loading loading-spinner loading-xs" /> : <Plus size={14} />}
              إضافة
            </button>
          </form>
          {validationErrors.quickAdd && (
            <p className="mt-1 text-[10px] text-error">{validationErrors.quickAdd}</p>
          )}
        </div>
      )}

      {/* Pricing */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PriceField
          id="item-rental-price"
          label="سعر الإيجار (AED)"
          value={rentalPrice}
          onChange={setRentalPrice}
          error={validationErrors.rentalPrice}
          busy={busy}
        />
        <PriceField
          id="item-sale-price"
          label="سعر البيع (AED)"
          value={salePrice}
          onChange={setSalePrice}
          error={validationErrors.salePrice}
          busy={busy}
        />
        <PriceField
          id="item-purchase-price"
          label="سعر التكلفة (AED)"
          value={purchasePrice}
          onChange={setPurchasePrice}
          error={validationErrors.purchasePrice}
          busy={busy}
        />
      </div>

      {/* Status & condition */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="form-control w-full">
          <label htmlFor="item-status" className="label-text mb-1 text-xs">الحالة في الكتالوج</label>
          <select
            id="item-status"
            className="select select-bordered w-full bg-base-300"
            value={status}
            onChange={(e) => setStatus(e.target.value as Exclude<CreateItemPayload['status'], undefined>)}
            disabled={busy}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="form-control w-full">
          <label htmlFor="item-condition" className="label-text mb-1 text-xs">الحالة الفنية</label>
          <select
            id="item-condition"
            className="select select-bordered w-full bg-base-300"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Exclude<CreateItemPayload['condition'], undefined>)}
            disabled={busy}
          >
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Upload */}
      <div className="form-control w-full">
        <label className="label-text mb-1 text-xs">الصور (اختياري)</label>
        <div className="space-y-2">
          <label className="input input-bordered w-full bg-base-200 flex items-center justify-center gap-2 h-24 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleMediaSelect}
              disabled={busy}
            />
            <div className="text-center">
              <ImageIcon size={24} className="text-base-content/30 mx-auto mb-1" />
              <span className="text-xs text-base-content/50">سحب وإفلات أو انقر لاختيار الصور</span>
              <span className="text-[9px] text-base-content/40 block">(PNG, JPG, WebP — يدعم متعدد)</span>
            </div>
          </label>
          {pendingMedia.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {pendingMedia.map((m, idx) => (
                <div key={m.id} className="relative group p-2 bg-base-200/50 rounded-xl border border-base-content/5">
                  {m.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
                      <span className="loading loading-spinner loading-sm" />
                    </div>
                  )}
                  {m.status === 'error' && (
                    <div className="absolute inset-0 bg-error/10 flex items-center justify-center z-10 rounded-xl text-error text-xs">
                      {m.error}
                    </div>
                  )}
                  {m.status === 'done' && (
                    <div className="absolute inset-0 bg-success/10 flex items-center justify-center z-10 rounded-xl text-success">
                      <Check size={16} />
                    </div>
                  )}
                  <img
                    src={URL.createObjectURL(m.file)}
                    alt={m.file.name}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-[8px] text-center">
                    {m.isPrimary ? 'رئيسي' : 'إضافي'}
                    {m.status === 'pending' && <span className="ml-1 text-warning">(قيد الانتظار)</span>}
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 btn btn-ghost btn-square btn-xs opacity-0 group-hover:opacity-100 transition-opacity text-error"
                    onClick={() => removeMedia(m.id)}
                    aria-label="إزالة"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    type="button"
                    className="absolute top-1 left-1 btn btn-ghost btn-square btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setPrimaryMedia(m.id)}
                    aria-label={m.isPrimary ? 'محدد كرئيسي' : 'تعيين كرئيسي'}
                  >
                    {m.isPrimary ? <Check size={12} className="text-primary" /> : <span className="text-base-content/70">1</span>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barcode */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="form-control w-full">
          <label htmlFor="item-barcode" className="label-text mb-1 text-xs">باركود محدد (اختياري)</label>
          <input
            id="item-barcode"
            type="text"
            className="input input-bordered w-full bg-base-300 font-mono"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={busy}
            placeholder="أدخل رمزاً أو اتركه فارغاً"
          />
        </div>
        <div className="form-control w-full justify-end">
          <label className="label cursor-pointer gap-3 justify-start py-2">
            <span className="label-text text-xs">توليد باركود تلقائياً</span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={generateBarcode}
              onChange={(e) => setGenerateBarcode(e.target.checked)}
              disabled={busy || Boolean(barcode.trim())}
            />
          </label>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm px-6" onClick={handleCancelClick} disabled={busy}>
          إلغاء
        </button>
        <button type="submit" className="btn btn-primary btn-sm px-6 font-bold" disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : 'حفظ القطعة'}
        </button>
      </div>
    </form>
  )
}

function TaxonomyField({
  label,
  value,
  options,
  onChange,
  disabled,
  canCreate,
  onCreate,
}: {
  label: string
  value: string
  options: Array<{ id: string; name: string }>
  onChange: (v: string) => void
  disabled: boolean
  canCreate: boolean
  onCreate: () => void
}) {
  return (
    <div className="form-control w-full">
      <label className="label-text mb-1 text-xs">{label}</label>
      <div className="flex gap-1.5">
        <select
          className="select select-bordered w-full bg-base-300"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label}
        >
          <option value="">اختر {label}...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {canCreate && (
          <button
            type="button"
            className="btn btn-square btn-outline"
            onClick={onCreate}
            disabled={disabled}
            aria-label={`إضافة ${label} جديد`}
            title={`إضافة ${label} جديد`}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function PriceField({
  id,
  label,
  value,
  onChange,
  error,
  busy,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  busy: boolean
}) {
  return (
    <div className="form-control w-full">
      <label htmlFor={id} className="label-text mb-1 text-xs">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        className={`input input-bordered w-full bg-base-300 ${error ? 'input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && (
        <span id={`${id}-err`} className="mt-1 text-[10px] text-error">{error}</span>
      )}
    </div>
  )
}
