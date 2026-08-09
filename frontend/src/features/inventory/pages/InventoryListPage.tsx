import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useDialog } from '@/app/providers/DialogProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useShortcuts } from '@/app/providers/ShortcutProvider'
import {
  useItemsList,
  useDeleteItem,
  useRestoreItem,
  useCategories,
  useBrands,
  useColors,
  useSizes,
} from '../hooks/useInventory'
import { InventoryDialog } from '../dialogs/InventoryDialog'
import type { ItemDto, ListItemsQuery } from '../api/api'
import { ItemThumbnail, StatusBadge, LifecycleBadge } from '../components/Badges'
import { formatFils } from '../constants/inventory'
import { ROUTES } from '@/shared/constants/routes'
import {
  Plus,
  Search,
  Trash2,
  RotateCcw,
  Edit3,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Package,
  Barcode,
  ListFilter,
  Trash2 as TrashIcon,
} from 'lucide-react'

const SORT_FIELDS = [
  { value: 'createdAt', label: 'تاريخ الإضافة' },
  { value: 'updatedAt', label: 'آخر تحديث' },
  { value: 'displayName', label: 'الاسم' },
  { value: 'internalCode', label: 'الرمز' },
] as const

const PAGE_SIZE = 20

export function InventoryListPage() {
  const { can } = usePermission()
  const navigate = useNavigate()
  const dialog = useDialog()
  const toast = useToast()
  const shortcuts = useShortcuts()

  const [q, setQ] = useState('')
  const [barcode, setBarcode] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [colorId, setColorId] = useState('')
  const [sizeId, setSizeId] = useState('')
  const [status, setStatus] = useState('')
  const [lifecycleState, setLifecycleState] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [offset, setOffset] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  const { data: categories = { items: [] } } = useCategories()
  const { data: brands = { items: [] } } = useBrands()
  const { data: colors = { items: [] } } = useColors()
  const { data: sizes = { items: [] } } = useSizes()

  const query = useMemo<ListItemsQuery>(() => {
    return {
      q: q.trim() || undefined,
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      colorId: colorId || undefined,
      sizeId: sizeId || undefined,
      status: status || undefined,
      lifecycleState: lifecycleState || undefined,
      deleted: showDeleted ? 'true' : 'false',
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset,
    }
  }, [q, barcode, categoryId, brandId, colorId, sizeId, status, lifecycleState, showDeleted, sortBy, sortDir, offset])

  const { data, isLoading, isError, refetch, isFetching } = useItemsList(query)

  const deleteItem = useDeleteItem()
  const restoreItem = useRestoreItem()

  const handleEditClick = useCallback((item: ItemDto) => {
    setSelectedItem(item)
    setDialogOpen(true)
  }, [])

  const handleCreateClick = useCallback(() => {
    setSelectedItem(null)
    setDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback(
    async (item: ItemDto) => {
      const ok = await dialog.confirm({
        title: 'حذف قطعة المخزون',
        message: `هل أنت متأكد من حذف القطعة «${item.displayName}» مؤقتاً؟`,
        confirmLabel: 'حذف',
        tone: 'error',
      })
      if (!ok) return
      try {
        await deleteItem.mutateAsync(item.id)
        toast.push({ title: 'تم الحذف المؤقت', description: item.displayName, tone: 'success' })
      } catch (err) {
        toast.push({
          title: 'فشل حذف القطعة',
          description: err instanceof Error ? err.message : undefined,
          tone: 'error',
        })
      }
    },
    [deleteItem, dialog, toast],
  )

  const handleRestoreClick = useCallback(
    async (item: ItemDto) => {
      const ok = await dialog.confirm({
        title: 'استعادة قطعة المخزون',
        message: `هل تريد استعادة القطعة «${item.displayName}»؟`,
        confirmLabel: 'استعادة',
      })
      if (!ok) return
      try {
        await restoreItem.mutateAsync(item.id)
        toast.push({ title: 'تمت الاستعادة', description: item.displayName, tone: 'success' })
      } catch (err) {
        toast.push({
          title: 'فشلت استعادة القطعة',
          description: err instanceof Error ? err.message : undefined,
          tone: 'error',
        })
      }
    },
    [restoreItem, dialog, toast],
  )

  const resetFilters = useCallback(() => {
    setQ('')
    setBarcode('')
    setCategoryId('')
    setBrandId('')
    setColorId('')
    setSizeId('')
    setStatus('')
    setLifecycleState('')
    setOffset(0)
  }, [])

  useEffect(() => {
    const unsub = shortcuts.register('Ctrl+N', handleCreateClick)
    return unsub
  }, [shortcuts, handleCreateClick])

  useEffect(() => {
    const unsub = shortcuts.register('Ctrl+F', () => searchRef.current?.focus())
    return unsub
  }, [shortcuts])

  useEffect(() => {
    const unsub = shortcuts.register('Escape', resetFilters)
    return unsub
  }, [shortcuts, resetFilters])

  const total = data?.meta?.total ?? 0
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters =
    Boolean(q || barcode || categoryId || brandId || colorId || sizeId || status || lifecycleState)

  return (
    <div className="flex h-full flex-col gap-4" dir="rtl">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-base-content">
            <Package className="text-primary" size={20} />
            كتالوج المخزون
          </h1>
          <p className="mt-0.5 text-xs text-base-content/50">
            إدارة قطع الفساتين والأزياء: الإضافة، التعديل، الباركود، دورة الحياة والتوفر
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowDeleted((v) => !v)
              setOffset(0)
            }}
            aria-pressed={showDeleted}
            className={`btn btn-sm ${showDeleted ? 'btn-error' : 'btn-outline'}`}
          >
            <TrashIcon size={14} />
            {showDeleted ? 'عرض النشطة' : 'المحذوفة'}
          </button>
          {can(PERMISSION.INVENTORY_CREATE) && (
            <button type="button" onClick={handleCreateClick} className="btn btn-primary btn-sm gap-1.5">
              <Plus size={15} />
              إضافة قطعة
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-box border border-base-content/10 bg-base-200/70 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control flex-1 basis-52">
            <span className="label-text mb-1 text-xs text-base-content/50">بحث بالاسم أو الرمز</span>
            <input
              ref={searchRef}
              type="search"
              className="input input-bordered input-sm w-full"
              placeholder="ابحث باسم القطعة أو الرمز الداخلي..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOffset(0)
              }}
            />
          </label>

          <label className="form-control basis-40">
            <span className="label-text mb-1 text-xs text-base-content/50">باركود</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="مسح/إدخال"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value)
                setOffset(0)
              }}
            />
          </label>

          <label className="form-control basis-40">
            <span className="label-text mb-1 text-xs text-base-content/50">التصنيف</span>
            <select
              className="select select-bordered select-sm w-full"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              {categories.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="form-control basis-40">
            <span className="label-text mb-1 text-xs text-base-content/50">البراند</span>
            <select
              className="select select-bordered select-sm w-full"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              {brands.items.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="form-control basis-40">
            <span className="label-text mb-1 text-xs text-base-content/50">اللون</span>
            <select
              className="select select-bordered select-sm w-full"
              value={colorId}
              onChange={(e) => {
                setColorId(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              {colors.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="form-control basis-36">
            <span className="label-text mb-1 text-xs text-base-content/50">المقاس</span>
            <select
              className="select select-bordered select-sm w-full"
              value={sizeId}
              onChange={(e) => {
                setSizeId(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              {sizes.items.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="form-control basis-36">
            <span className="label-text mb-1 text-xs text-base-content/50">الحالة</span>
            <select
              className="select select-bordered select-sm w-full"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              <option value="draft">مسودة</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="archived">مؤرشف</option>
              <option value="retired">متقاعد</option>
            </select>
          </label>

          <label className="form-control basis-44">
            <span className="label-text mb-1 text-xs text-base-content/50">دورة الحياة</span>
            <select
              className="select select-bordered select-sm w-full"
              value={lifecycleState}
              onChange={(e) => {
                setLifecycleState(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">الكل</option>
              <option value="available">متاح</option>
              <option value="reserved">محجوز</option>
              <option value="rented">مُستأجر</option>
              <option value="return_pending">بانتظار الإرجاع</option>
              <option value="inspection">بالفحص</option>
              <option value="cleaning">بالتنظيف</option>
              <option value="maintenance">بالصيانة</option>
              <option value="for_sale">للبيع</option>
              <option value="sold">مُباع</option>
              <option value="retired">متقاعد</option>
              <option value="lost">مفقود</option>
              <option value="damaged">تالف</option>
            </select>
          </label>

          <div className="flex items-center gap-1.5 pb-0.5">
            <label className="form-control">
              <span className="label-text mb-1 text-xs text-base-content/50">ترتيب</span>
              <select
                className="select select-bordered select-sm w-full"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  setOffset(0)
                }}
              >
                {SORT_FIELDS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-sm btn-square"
              title="اتجاه الترتيب"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              تحديث
            </button>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost gap-1"
                onClick={resetFilters}
              >
                <ListFilter size={14} />
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="جارٍ تحميل الكتالوج">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-base-300/50" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-base-content/70">تعذر تحميل الكتالوج.</p>
            <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void refetch()}>
              <RefreshCw size={14} />
              إعادة المحاولة
            </button>
          </div>
        ) : (data?.items?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Package size={40} className="text-base-content/20" />
            <p className="font-semibold text-base-content/60">
              {hasFilters ? 'لا توجد قطع مطابقة للفلاتر' : 'لا توجد قطع في الكتالوج بعد'}
            </p>
            {!hasFilters && can(PERMISSION.INVENTORY_CREATE) && (
              <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={handleCreateClick}>
                <Plus size={15} />
                إضافة أول قطعة
              </button>
            )}
            {hasFilters && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
                مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-full overflow-auto">
            <table className="table table-sm w-full">
              <thead className="sticky top-0 z-10 bg-base-300/90 backdrop-blur">
                <tr className="text-xs text-base-content/60">
                  <th className="w-16">الصورة</th>
                  <th>القطعة</th>
                  <th>التصنيف</th>
                  <th>البراند</th>
                  <th className="text-left">سعر الإيجار</th>
                  <th className="text-left">سعر البيع</th>
                  <th>الحالة</th>
                  <th>دورة الحياة</th>
                  <th>باركود</th>
                  <th className="text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-base-300/40"
                    onClick={() => navigate(`${ROUTES.INVENTORY}/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <ItemThumbnail item={item} />
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.displayName}</span>
                        <span className="font-mono text-[10px] text-primary">{item.internalCode}</span>
                      </div>
                    </td>
                    <td className="text-xs">{item.category?.name ?? '—'}</td>
                    <td className="text-xs">{item.brand?.name ?? '—'}</td>
                    <td className="text-left text-xs font-semibold text-primary tabular-nums">
                      {formatFils(item.rentalPrice)}
                    </td>
                    <td className="text-left text-xs tabular-nums">{formatFils(item.salePrice)}</td>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td>
                      <LifecycleBadge value={item.lifecycleState} />
                    </td>
                    <td>
                      {item.barcodes && item.barcodes.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-base-content/60">
                          <Barcode size={11} />
                          {item.barcodes[0].value}
                        </span>
                      ) : (
                        <span className="text-[10px] text-base-content/30">—</span>
                      )}
                    </td>
                    <td className="text-left">
                      <div
                        className="flex justify-end gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-square btn-xs"
                          title="عرض التفاصيل"
                          onClick={() => navigate(`${ROUTES.INVENTORY}/${item.id}`)}
                        >
                          <Eye size={14} />
                        </button>
                        {!showDeleted ? (
                          <>
                            {can(PERMISSION.INVENTORY_UPDATE) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-square btn-xs text-info"
                                title="تعديل البيانات"
                                onClick={() => handleEditClick(item)}
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            {can(PERMISSION.INVENTORY_DELETE) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-square btn-xs text-error"
                                title="حذف مؤقت"
                                onClick={() => void handleDeleteClick(item)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          can(PERMISSION.INVENTORY_RESTORE) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-square btn-xs text-success"
                              title="استعادة"
                              onClick={() => void handleRestoreClick(item)}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && total > 0 && (
          <div className="flex items-center justify-between border-t border-base-content/10 bg-base-300/40 px-4 py-2.5">
            <span className="text-xs text-base-content/50 tabular-nums">
              عرض {offset + 1} – {Math.min(offset + PAGE_SIZE, total)} من {total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                aria-label="الصفحة السابقة"
              >
                <ChevronRight size={16} />
              </button>
              <span className="px-1 text-xs font-semibold tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                aria-label="الصفحة التالية"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <InventoryDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={selectedItem}
      />
    </div>
  )
}
