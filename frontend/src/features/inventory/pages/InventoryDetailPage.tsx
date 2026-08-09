import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useDialog } from '@/app/providers/DialogProvider'
import { useToast } from '@/app/providers/ToastProvider'
import {
  useItemDetail,
  useItemLifecycleState,
  useItemHistory,
  useTransitionItem,
} from '../hooks/useInventory'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { StatusBadge, ConditionBadge, LifecycleBadge, ItemThumbnail } from '../components/Badges'
import {
  ChevronRight,
  DollarSign,
  Info,
  History,
  Barcode,
  Wrench,
  AlertTriangle,
  Edit3,
  ArrowLeft,
  RefreshCw,
  Image,
} from 'lucide-react'
import { ROUTES } from '@/shared/constants/routes'
import { formatFils, formatDateTime, LIFECYCLE_LABELS, LIFECYCLE_TRANSITIONS } from '../constants/inventory'
import { InventoryDialog } from '../dialogs/InventoryDialog'
import type { ItemLifecycleState } from '../api/api'

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermission()
  const dialog = useDialog()
  const toast = useToast()

  const itemId = id ?? ''
  const { data: item, isLoading, isError, refetch } = useItemDetail(itemId)
  const { data: state, isLoading: stateLoading } = useItemLifecycleState(itemId)
  const { data: history } = useItemHistory(itemId)
  const transition = useTransitionItem(itemId)

  const [editOpen, setEditOpen] = useState(false)
  const [transitionReason, setTransitionReason] = useState('')
  const [transitionTarget, setTransitionTarget] = useState<ItemLifecycleState | null>(null)

  const allowed = state ? LIFECYCLE_TRANSITIONS[state.lifecycleState as ItemLifecycleState] ?? [] : []

  const handleTransition = async (target: ItemLifecycleState) => {
    if (!state) return
    let reason = ''
    if (state.lifecycleState === 'damaged' || target === 'lost' || target === 'damaged' || target === 'retired') {
      const ok = await dialog.confirm({
        title: 'تغيير دورة الحياة',
        message: `تحويل القطعة إلى «${LIFECYCLE_LABELS[target]}». هل أنت متأكد؟`,
        confirmLabel: 'تأكيد التحويل',
        tone: target === 'lost' || target === 'damaged' ? 'error' : 'default',
      })
      if (!ok) return
    }
    try {
      await transition.mutateAsync({
        newState: target,
        reason: reason || undefined,
        expectedState: state.lifecycleState,
      })
      toast.push({ title: 'تم تغيير دورة الحياة', description: LIFECYCLE_LABELS[target], tone: 'success' })
      setTransitionTarget(null)
      setTransitionReason('')
    } catch (err) {
      toast.push({
        title: 'فشل تغيير دورة الحياة',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" dir="rtl">
        <span className="loading loading-spinner text-primary loading-lg" />
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="mx-auto mt-8 flex max-w-lg flex-col gap-3" dir="rtl">
        <div className="alert alert-error text-sm">
          <AlertTriangle size={18} />
          <span>تعذر تحميل تفاصيل قطعة المخزون.</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(ROUTES.INVENTORY)}>
          <ArrowLeft size={14} />
          العودة للكتالوج
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-sm" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-content/5 pb-3">
        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-primary"
            onClick={() => navigate(ROUTES.INVENTORY)}
          >
            <ArrowLeft size={14} />
            كتالوج المخزون
          </button>
          <span>/</span>
          <span className="font-bold text-base-content">{item.displayName}</span>
        </div>
        {can(PERMISSION.INVENTORY_UPDATE) && (
          <button
            type="button"
            className="btn btn-sm btn-outline gap-1.5"
            onClick={() => setEditOpen(true)}
          >
            <Edit3 size={14} />
            تعديل البيانات
          </button>
        )}
      </div>

      {/* Identity header */}
      <div className="card border border-base-content/10 bg-base-300/60 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <ItemThumbnail item={item} className="h-24 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-base-content">{item.displayName}</h1>
              <span className="badge badge-primary font-mono text-xs">{item.internalCode}</span>
              <StatusBadge value={item.status} />
              <LifecycleBadge value={item.lifecycleState} />
            </div>
            {item.description ? (
              <p className="max-w-2xl text-xs leading-relaxed text-base-content/60">{item.description}</p>
            ) : (
              <p className="text-xs text-base-content/30">لا يوجد وصف.</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="badge badge-outline badge-xs">التصنيف: {item.category?.name ?? 'غير محدد'}</span>
              <span className="badge badge-outline badge-xs">البراند: {item.brand?.name ?? 'غير محدد'}</span>
              {item.color && (
                <span className="badge badge-outline badge-xs" style={{ borderInlineStart: `4px solid ${item.color.hexCode ?? 'transparent'}` }}>
                  اللون: {item.color.name}
                </span>
              )}
              <span className="badge badge-outline badge-xs">المقاس: {item.size?.name ?? 'غير محدد'}</span>
              <span className="badge badge-outline badge-xs">
                الحالة الفنية: <ConditionBadge value={item.condition} />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Right column */}
        <div className="space-y-5">
          <AvailabilityPanel itemId={item.id} />

          {/* Pricing */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <DollarSign size={15} className="text-primary" />
              الأسعار
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-base-content/50">إيجار (اليوم)</span>
                <span className="font-bold tabular-nums text-primary">{formatFils(item.rentalPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base-content/50">بيع</span>
                <span className="font-bold tabular-nums">{formatFils(item.salePrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base-content/50">تكلفة الشراء</span>
                <span className="font-semibold tabular-nums text-base-content/70">{formatFils(item.purchasePrice)}</span>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <Info size={15} className="text-primary" />
              معلومات
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-base-content/50">تاريخ الإضافة</dt>
                <dd className="font-semibold">{formatDateTime(item.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-base-content/50">آخر تحديث</dt>
                <dd className="font-semibold">{formatDateTime(item.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Lifecycle */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <Wrench size={15} className="text-primary" />
              دورة الحياة
            </h3>

            {stateLoading ? (
              <div className="h-20 animate-pulse rounded-lg bg-base-300/50" aria-busy="true" />
            ) : state ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCell label="الحالة الحالية" value={LIFECYCLE_LABELS[state.lifecycleState as ItemLifecycleState] ?? state.lifecycleState} />
                  <StatCell label="قابل للتشغيل" value={state.isOperational ? 'نعم' : 'لا'} />
                  <StatCell label="قابل للإيجار" value={state.isRentable ? 'نعم' : 'لا'} />
                  <StatCell label="قابل للبيع" value={state.isSellable ? 'نعم' : 'لا'} />
                </div>

                {can(PERMISSION.INVENTORY_TRANSITION) && allowed.length > 0 && (
                  <div className="mt-4 border-t border-base-content/5 pt-3">
                    <div className="mb-2 text-xs font-semibold text-base-content/50">إجراء متاح:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {allowed.map((target) => (
                        <button
                          key={target}
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={transition.isPending}
                          onClick={() => setTransitionTarget(target)}
                        >
                          {LIFECYCLE_LABELS[target]}
                        </button>
                      ))}
                    </div>

                    {transitionTarget && (
                      <div className="mt-3 flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-200/60 p-3">
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-base-content/50">
                            تحويل إلى «{LIFECYCLE_LABELS[transitionTarget]}» — سبب (اختياري)
                          </span>
                          <input
                            type="text"
                            className="input input-bordered input-sm"
                            value={transitionReason}
                            onChange={(e) => setTransitionReason(e.target.value)}
                            placeholder="مثال: عودة من الإيجار، تلف..."
                          />
                        </label>
                        <div className="flex justify-end gap-1.5">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTransitionTarget(null)}>
                            إلغاء
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={transition.isPending}
                            onClick={() => void handleTransition(transitionTarget)}
                          >
                            {transition.isPending ? <span className="loading loading-spinner loading-xs" /> : 'تأكيد التحويل'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* History */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <History size={15} className="text-primary" />
              سجل دورة الحياة
            </h3>
            {!history || history.items.length === 0 ? (
              <p className="text-xs text-base-content/40">لا يوجد سجل بعد.</p>
            ) : (
              <ul className="space-y-2">
                {history.items.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-base-200/40 px-3 py-2 text-xs">
                    <LifecycleBadge value={h.oldState} />
                    <ChevronRight size={12} className="text-base-content/30" />
                    <LifecycleBadge value={h.newState} />
                    <span className="text-base-content/40">{formatDateTime(h.createdAt)}</span>
                    {h.username && <span className="text-base-content/40">بواسطة {h.username}</span>}
                    {h.reason && <span className="text-base-content/50">— {h.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Barcodes */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <Barcode size={15} className="text-primary" />
              الباركود
            </h3>
            {!item.barcodes || item.barcodes.length === 0 ? (
              <p className="text-xs text-base-content/40">
                لا توجد رموز باركود مرتبطة. يمكن إضافة رمز عند التعديل.
              </p>
            ) : (
              <ul className="space-y-2">
                {item.barcodes.map((bc) => (
                  <li
                    key={bc.id}
                    className="flex items-center justify-between rounded-lg bg-base-200/40 px-3 py-2"
                  >
                    <span className="font-mono text-sm font-bold text-primary">{bc.value}</span>
                    {bc.isPrimary ? <span className="badge badge-accent badge-xs">أساسي</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Media */}
          <div className="card border border-base-content/10 bg-base-300/60 p-4 shadow">
            <h3 className="mb-3 flex items-center gap-2 border-b border-base-content/5 pb-2 text-sm font-bold text-base-content/60">
              <Image size={15} className="text-primary" />
              الوسائط ({item.media?.length ?? 0})
            </h3>
            {!item.media || item.media.length === 0 ? (
              <p className="text-xs text-base-content/40">لا توجد ملفات مرفقة.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {item.media.map((m) => (
                  <li key={m.id} className="rounded-lg border border-base-content/10 bg-base-200/40 p-2.5 text-xs">
                    <div className="mb-1 flex h-16 items-center justify-center rounded-md bg-base-300/50">
                      <Image size={20} className="text-base-content/30" />
                    </div>
                    <div className="truncate text-base-content/70" title={m.mediaFile.originalFilename}>
                      {m.mediaFile.originalFilename}
                    </div>
                    <div className="truncate text-[10px] text-base-content/40" dir="ltr">
                      {m.mediaFile.mimeType}
                    </div>
                    {m.isPrimary && <span className="badge badge-accent badge-xs mt-1">أساسي</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={() => void refetch()}>
        <RefreshCw size={14} />
        تحديث البيانات
      </button>

      <InventoryDialog
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        item={item}
      />
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
      <div className="text-[10px] text-base-content/50">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-base-content">{value}</div>
    </div>
  )
}
