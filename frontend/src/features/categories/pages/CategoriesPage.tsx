import { useState } from 'react'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useToast } from '@/app/providers/ToastProvider'
import { useDialog } from '@/app/providers/DialogProvider'
import { useCategories, useCreateTaxonomy, useUpdateCategory, useDeleteCategory, useRestoreCategory } from '@/features/inventory/hooks/useInventory'
import type { TaxonomyDto } from '@/features/inventory/api/api'
import { Layers, Plus, Search, Edit3, Trash2, RotateCcw, AlertTriangle } from 'lucide-react'

export function CategoriesPage() {
  const { can } = usePermission()
  const toast = useToast()
  const dialog = useDialog()

  const [q, setQ] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [editing, setEditing] = useState<TaxonomyDto | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data, isLoading, isError } = useCategories({
    q: q.trim() || undefined,
    deleted: showDeleted ? 'true' : undefined,
    limit: 200,
  })

  const createCat = useCreateTaxonomy('category')
  const updateCat = useUpdateCategory()
  const deleteCat = useDeleteCategory()
  const restoreCat = useRestoreCategory()

  const canCreate = can(PERMISSION.CATEGORIES_CREATE)
  const canUpdate = can(PERMISSION.CATEGORIES_UPDATE)
  const canDelete = can(PERMISSION.CATEGORIES_DELETE)
  const canRestore = can(PERMISSION.CATEGORIES_RESTORE)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setCreating(true)
  }

  const openEdit = (cat: TaxonomyDto) => {
    setEditing(cat)
    setName(cat.name)
    setDescription(cat.description ?? '')
    setCreating(true)
  }

  const close = () => {
    setCreating(false)
    setEditing(null)
    setName('')
    setDescription('')
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.push({ title: 'اسم التصنيف مطلوب', tone: 'warning' })
      return
    }
    const payload = {
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    }
    try {
      if (editing) {
        await updateCat.mutateAsync({ id: editing.id, payload })
        toast.push({ title: 'تم تحديث التصنيف', tone: 'success' })
      } else {
        await createCat.mutateAsync(payload)
        toast.push({ title: 'تمت إضافة التصنيف', tone: 'success' })
      }
      close()
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل الحفظ', tone: 'error' })
    }
  }

  const handleDelete = async (cat: TaxonomyDto) => {
    const ok = await dialog.confirm({
      title: 'حذف التصنيف',
      message: `حذف التصنيف "${cat.name}" مؤقتاً؟`,
      confirmLabel: 'حذف',
      tone: 'error',
    })
    if (!ok) return
    try {
      await deleteCat.mutateAsync(cat.id)
      toast.push({ title: 'تم الحذف المؤقت', tone: 'success' })
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل الحذف', tone: 'error' })
    }
  }

  const handleRestore = async (cat: TaxonomyDto) => {
    try {
      await restoreCat.mutateAsync(cat.id)
      toast.push({ title: 'تمت الاستعادة', tone: 'success' })
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل الاستعادة', tone: 'error' })
    }
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Layers className="text-primary" />
            إدارة التصنيفات
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            إدارة التصنيفات التي تُستخدم في نموذج القطعة
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className={`btn btn-sm ${showDeleted ? 'btn-error' : 'btn-outline border-base-content/10'}`}
          >
            {showDeleted ? 'عرض النشطين' : 'سلة المحذوفات'}
          </button>
          {canCreate && (
            <button onClick={openCreate} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              إضافة تصنيف
            </button>
          )}
        </div>
      </div>

      <div className="form-control w-full max-w-sm">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث عن تصنيف..."
            className="input input-bordered w-full bg-base-200 pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
            <Search size={16} />
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-base-300/50 rounded-lg animate-pulse" />)}</div>
      ) : isError ? (
        <div className="alert alert-error text-xs flex gap-2"><AlertTriangle size={14} /><span>فشل تحميل التصنيفات.</span></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="card bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl p-10 text-center text-xs text-base-content/40">
          لا توجد تصنيفات مطابقة
        </div>
      ) : (
        <div className="card bg-base-300/40 border border-base-content/10 rounded-xl overflow-hidden">
          <table className="table table-sm w-full">
            <thead>
              <tr className="text-[10px] text-base-content/50 border-b border-base-content/10">
                <th>الاسم</th>
                <th>الوصف</th>
                <th>الحالة</th>
                <th className="text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((cat) => (
                <tr key={cat.id} className="border-b border-base-content/5 hover:bg-base-200/40">
                  <td className="font-bold text-sm">{cat.name}</td>
                  <td className="text-xs text-base-content/60 max-w-[260px] truncate">{cat.description ?? '—'}</td>
                  <td>
                    <span className={`badge badge-xs ${cat.isActive === false ? 'badge-ghost' : 'badge-success'}`}>
                      {cat.isActive === false ? 'معطل' : 'نشط'}
                    </span>
                  </td>
                  <td className="text-left flex justify-end gap-1">
                    {!showDeleted ? (
                      <>
                        {canUpdate && (
                          <button onClick={() => openEdit(cat)} className="btn btn-ghost btn-square btn-xs text-info" title="تعديل">
                            <Edit3 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => void handleDelete(cat)} className="btn btn-ghost btn-square btn-xs text-error" title="حذف">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    ) : (
                      canRestore && (
                        <button onClick={() => void handleRestore(cat)} className="btn btn-ghost btn-square btn-xs text-success" title="استعادة">
                          <RotateCcw size={14} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <dialog className="modal modal-open" dir="rtl">
          <div className="modal-box border border-base-content/10 bg-base-200 max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</h3>
            <div className="space-y-3">
              <label className="form-control w-full">
                <span className="label-text mb-1 text-xs">الاسم *</span>
                <input
                  type="text"
                  className="input input-bordered w-full bg-base-300"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text mb-1 text-xs">الوصف</span>
                <textarea
                  className="textarea textarea-bordered w-full bg-base-300"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={close}>إلغاء</button>
              <button className="btn btn-primary" onClick={() => void handleSave()} disabled={createCat.isPending || updateCat.isPending}>
                {(createCat.isPending || updateCat.isPending) ? <span className="loading loading-spinner loading-xs" /> : 'حفظ'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={close}>close</button>
          </form>
        </dialog>
      )}
    </div>
  )
}
