import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { 
  useItemsList, 
  useDeleteItem, 
  useRestoreItem, 
  useCategories, 
  useBrands 
} from '../hooks/useInventory'
import { InventoryDialog } from '../dialogs/InventoryDialog'
import type { ItemDto } from '../api/api'
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
  AlertTriangle,
  LayoutGrid,
  List,
  Shirt,
  Info
} from 'lucide-react'

// Fils to AED helper
function formatFils(fils: number | null | undefined): string {
  if (!fils) return '—'
  return `${(fils / 1000).toLocaleString('ar-AE', { maximumFractionDigits: 2 })} د.إ`
}

export function InventoryListPage() {
  const { can } = usePermission()
  const navigate = useNavigate()

  // Layout View Switcher
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')

  // Filter & Search states
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [status, setStatus] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [limit] = useState(10)
  const [offset, setOffset] = useState(0)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null)

  // Taxonomy queries
  const { data: categories = [] } = useCategories()
  const { data: brands = [] } = useBrands()

  // List Query Hook
  const { data, isLoading, isError, refetch } = useItemsList({
    q: q.trim() || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    status: status || undefined,
    deleted: showDeleted ? 'true' : 'false',
    sortBy,
    sortDir,
    limit,
    offset
  })

  // Mutation Hooks
  const deleteItem = useDeleteItem()
  const restoreItem = useRestoreItem()

  const handleEditClick = (item: ItemDto) => {
    setSelectedItem(item)
    setDialogOpen(true)
  }

  const handleCreateClick = () => {
    setSelectedItem(null)
    setDialogOpen(true)
  }

  const handleDeleteClick = async (id: string, name: string) => {
    const ok = window.confirm(`هل أنت متأكد من حذف القطعة "${name}" مؤقتاً؟`)
    if (!ok) return
    try {
      await deleteItem.mutateAsync(id)
    } catch (err: any) {
      alert(err?.message || 'فشل حذف القطعة.')
    }
  }

  const handleRestoreClick = async (id: string, name: string) => {
    const ok = window.confirm(`هل تريد استعادة القطعة "${name}"؟`)
    if (!ok) return
    try {
      await restoreItem.mutateAsync(id)
    } catch (err: any) {
      alert(err?.message || 'فشل استعادة القطعة.')
    }
  }

  const handlePageChange = (nextOffset: number) => {
    if (nextOffset >= 0) {
      setOffset(nextOffset)
    }
  }

  const toggleDeletedView = () => {
    setShowDeleted(!showDeleted)
    setOffset(0)
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = data ? Math.ceil(data.total / limit) : 1

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Shirt className="text-primary" />
            كتالوج المخزون العام
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            إدارة وتتبع الفساتين والقطع الفنية المتاحة للإيجار أو البيع
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="join border border-base-content/10">
            <button
              onClick={() => setViewMode('table')}
              className={`btn btn-xs join-item ${viewMode === 'table' ? 'btn-active btn-primary' : 'btn-ghost'}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`btn btn-xs join-item ${viewMode === 'gallery' ? 'btn-active btn-primary' : 'btn-ghost'}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          <button
            onClick={toggleDeletedView}
            className={`btn btn-sm ${showDeleted ? 'btn-error' : 'btn-outline border-base-content/10'}`}
          >
            {showDeleted ? 'عرض النشط' : 'سلة المحذوفات'}
          </button>
          {can(PERMISSION.INVENTORY_CREATE) && (
            <button onClick={handleCreateClick} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              إضافة قطعة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-5 bg-base-300/40 p-4 rounded-xl border border-base-content/5 items-end">
        <div className="form-control w-full col-span-2">
          <span className="label-text mb-1.5 text-xs text-base-content/50">بحث سريع بالاسم</span>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم القطعة..."
              className="input input-bordered w-full bg-base-200 pl-10 text-xs h-10"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOffset(0)
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
              <Search size={16} />
            </span>
          </div>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">التصنيف</span>
          <select
            className="select select-bordered w-full bg-base-200 text-xs h-10 min-h-0"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">البراند</span>
          <select
            className="select select-bordered w-full bg-base-200 text-xs h-10 min-h-0"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">كل الماركات</option>
            {brands.map((br) => (
              <option key={br.id} value={br.id}>{br.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => void refetch()}
          className="btn btn-outline border-base-content/10 hover:border-primary/20 btn-md text-xs w-full flex items-center justify-center gap-2 h-10 min-h-0"
        >
          <RefreshCw size={14} />
          تحديث التصفية
        </button>
      </div>

      {/* Main Grid View Switcher */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-base-300/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="alert alert-error text-sm flex gap-2">
          <AlertTriangle size={18} />
          <span>حدث خطأ أثناء تحميل قطع المخزون.</span>
        </div>
      ) : (data?.data || []).length === 0 ? (
        <div className="text-center py-16 bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl flex flex-col items-center justify-center">
          <Shirt size={48} className="text-base-content/20 mb-3" />
          <p className="font-bold text-base-content/50">لا توجد قطع مخزون مطابقة للبحث</p>
          <p className="text-xs text-base-content/40 mt-1">تأكد من كتابة الاسم أو تعديل فلاتر الكتالوج</p>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Photo Gallery Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {(data?.data || []).map((item) => (
            <div key={item.id} className="card bg-base-300/40 border border-base-content/10 shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between">
              <figure className="h-44 bg-base-200 relative flex items-center justify-center overflow-hidden">
                <Shirt size={48} className="text-base-content/20" />
                <span className="absolute bottom-2 right-2 badge badge-neutral badge-xs text-[9px] font-mono">{item.internalCode}</span>
              </figure>
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm text-base-content line-clamp-1">{item.displayName}</h3>
                  <div className="flex gap-1.5 mt-1.5 wrap">
                    <span className="badge badge-outline badge-xs text-[9px]">{item.category?.name || 'تصنيف'}</span>
                    <span className="badge badge-outline badge-xs text-[9px]">{item.brand?.name || 'ماركة'}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-base-content/5 pt-3">
                  <div>
                    <p className="text-[10px] text-base-content/50">سعر الإيجار</p>
                    <p className="text-xs font-bold text-primary">{formatFils(item.rentalPrice)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => navigate(`/inventory/${item.id}`)}
                      className="btn btn-ghost btn-square btn-xs text-primary"
                      title="عرض"
                    >
                      <Eye size={12} />
                    </button>
                    {!showDeleted ? (
                      <>
                        {can(PERMISSION.INVENTORY_UPDATE) && (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="btn btn-ghost btn-square btn-xs text-info"
                            title="تعديل"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                        {can(PERMISSION.INVENTORY_DELETE) && (
                          <button
                            onClick={() => void handleDeleteClick(item.id, item.displayName)}
                            className="btn btn-ghost btn-square btn-xs text-error"
                            title="حذف"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    ) : (
                      can(PERMISSION.INVENTORY_RESTORE) && (
                        <button
                          onClick={() => void handleRestoreClick(item.id, item.displayName)}
                          className="btn btn-ghost btn-square btn-xs text-success"
                          title="استعادة"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="overflow-x-auto border border-base-content/10 bg-base-300/40 rounded-xl shadow-md">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-base-content/10 text-xs text-base-content/60">
                <th>الرمز التعريفي</th>
                <th>اسم القطعة</th>
                <th>التصنيف</th>
                <th>الماركة</th>
                <th>سعر الإيجار</th>
                <th>الحالة</th>
                <th>البيئة الحياتية</th>
                <th className="text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map((item) => (
                <tr key={item.id} className="border-b border-base-content/5 hover:bg-base-200/40 transition-colors">
                  <td className="font-mono font-bold text-primary">{item.internalCode}</td>
                  <td className="font-bold">{item.displayName}</td>
                  <td>{item.category?.name || '—'}</td>
                  <td>{item.brand?.name || '—'}</td>
                  <td className="font-bold text-primary">{formatFils(item.rentalPrice)}</td>
                  <td>
                    {item.status === 'active' ? (
                      <span className="badge badge-success badge-xs font-bold text-[9px] rounded-sm">نشط</span>
                    ) : (
                      <span className="badge badge-ghost badge-xs font-bold text-[9px] rounded-sm">غير نشط</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-neutral badge-xs font-mono text-[9px]">{item.lifecycleState}</span>
                  </td>
                  <td className="text-left flex justify-end gap-1">
                    <button
                      onClick={() => navigate(`/inventory/${item.id}`)}
                      className="btn btn-ghost btn-square btn-xs text-primary"
                      title="عرض التفاصيل"
                    >
                      <Eye size={14} />
                    </button>
                    {!showDeleted ? (
                      <>
                        {can(PERMISSION.INVENTORY_UPDATE) && (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="btn btn-ghost btn-square btn-xs text-info"
                            title="تعديل البيانات"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {can(PERMISSION.INVENTORY_DELETE) && (
                          <button
                            onClick={() => void handleDeleteClick(item.id, item.displayName)}
                            className="btn btn-ghost btn-square btn-xs text-error"
                            title="حذف مؤقت"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    ) : (
                      can(PERMISSION.INVENTORY_RESTORE) && (
                        <button
                          onClick={() => void handleRestoreClick(item.id, item.displayName)}
                          className="btn btn-ghost btn-square btn-xs text-success"
                          title="استعادة"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-between items-center p-4 border-t border-base-content/5 bg-base-300/60">
            <span className="text-xs text-base-content/50">
              عرض {offset + 1} - {Math.min(offset + limit, data?.total ?? 0)} من إجمالي {data?.total ?? 0} قطع
            </span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => handlePageChange(offset - limit)}
                disabled={offset === 0}
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-xs font-bold self-center px-2">صفحة {page} من {totalPages}</span>
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => handlePageChange(offset + limit)}
                disabled={offset + limit >= (data?.total ?? 0)}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Create/Edit Dialog */}
      <InventoryDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={selectedItem}
      />
    </div>
  )
}
