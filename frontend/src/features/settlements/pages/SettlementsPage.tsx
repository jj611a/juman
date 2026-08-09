import { useState } from 'react'
import { useSettlementsList, useSettlementDetail, useSettlementPayment, useSettlementRefund, useSettlementAdjustment, useSettlementDiscount, useSettlementLateFee, useSettlementClose, useSettlementCancel } from '../hooks/useSettlements'
import { SETTLEMENT_STATUS_VALUES, type SettlementStatus } from '../api/api'
import { useToast } from '@/app/providers/ToastProvider'
import { useDialog } from '@/app/providers/DialogProvider'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { formatFils, formatDateTime } from './settlementUtils'
import { PaymentDialog } from '@/features/finance/components/PaymentDialog'
import { AlertTriangle, RefreshCw, ChevronRight, ChevronLeft, Wallet, Banknote, Receipt, PlusCircle, Percent, Clock4, Lock, XCircle } from 'lucide-react'

const STATUS_LABELS: Record<SettlementStatus, string> = {
  open: 'مفتوحة',
  partially_paid: 'مسددة جزئياً',
  paid: 'مدفوعة',
  cancelled: 'ملغاة',
  closed: 'مغلقة',
}

const STATUS_BADGE: Record<SettlementStatus, string> = {
  open: 'badge-warning',
  partially_paid: 'badge-info',
  paid: 'badge-success',
  cancelled: 'badge-error',
  closed: 'badge-neutral',
}

type Modifier = 'payment' | 'refund' | 'adjustment' | 'discount' | 'latefee' | null

const PAGE_SIZE = 20

export function SettlementsPage() {
  const { can } = usePermission()
  const toast = useToast()
  const dialog = useDialog()

  const [status, setStatus] = useState<string>('')
  const [entityType, setEntityType] = useState<string>('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modifier, setModifier] = useState<Modifier>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const { data, isLoading, isError, refetch } = useSettlementsList({
    q: q.trim() || undefined,
    status: status || undefined,
    entityType: entityType || undefined,
    sortBy: 'createdAt',
    sortDir: 'desc',
    limit: PAGE_SIZE,
    offset,
  })
  const { data: detail, refetch: refetchDetail } = useSettlementDetail(selectedId ?? '')

  const paymentMut = useSettlementPayment()
  const refundMut = useSettlementRefund()
  const adjustmentMut = useSettlementAdjustment()
  const discountMut = useSettlementDiscount()
  const lateFeeMut = useSettlementLateFee()
  const closeMut = useSettlementClose()
  const cancelMut = useSettlementCancel()

  const canManage = can(PERMISSION.FINANCE_SETTLEMENT_MANAGE)
  const canAdjust = can(PERMISSION.FINANCE_ADJUSTMENT)

  const total = data?.meta?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.floor(offset / PAGE_SIZE) + 1

  const dismiss = () => {
    setModifier(null)
    setAmount('')
    setReason('')
  }

  const handleModifierSubmit = async () => {
    if (!selectedId || !modifier) return
    const amountFils = modifier === 'latefee' ? 0 : Math.round(Number(amount) * 1000)
    if (!modifier.startsWith('discount') && !modifier.startsWith('latefee') && (!amountFils || amountFils <= 0)) {
      toast.push({ title: 'أدخل مبلغاً صحيحاً', tone: 'warning' })
      return
    }
    const busy = [paymentMut, refundMut, adjustmentMut, discountMut, lateFeeMut].some((m) => m.isPending)
    if (busy) return
    try {
      const base = { reason: reason.trim() || undefined, idempotencyKey: `ui-${Date.now()}` }
      switch (modifier) {
        case 'refund':
          await refundMut.mutateAsync({ id: selectedId, body: { amountFils, reason: reason.trim() || 'مردود', idempotencyKey: base.idempotencyKey } })
          break
        case 'adjustment':
          await adjustmentMut.mutateAsync({ id: selectedId, body: { amountFils: Math.abs(amountFils), reason: reason.trim() || 'تعديل', idempotencyKey: base.idempotencyKey } })
          break
        case 'discount':
          await discountMut.mutateAsync({ id: selectedId, body: { kind: 'fixed', amountFils, reason: reason.trim() || 'خصم', idempotencyKey: base.idempotencyKey } })
          break
        case 'latefee':
          await lateFeeMut.mutateAsync({ id: selectedId, body: { kind: 'flat', flatFils: Math.round(Number(amount) * 1000) || undefined, reason: reason.trim() || 'غرامة', idempotencyKey: base.idempotencyKey } })
          break
      }
      toast.push({ title: 'تمت العملية بنجاح', tone: 'success' })
      dismiss()
      void refetchDetail()
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشلت العملية', tone: 'error' })
    }
  }

  const handleClose = async () => {
    if (!selectedId) return
    const ok = await dialog.confirm({ title: 'إغلاق التسوية', message: 'الإغلاق نهائي ولا يمكن التراجع. متابعة؟', confirmLabel: 'إغلاق', tone: 'error' })
    if (!ok) return
    try {
      await closeMut.mutateAsync({ id: selectedId, body: {} })
      toast.push({ title: 'تم إغلاق التسوية', tone: 'success' })
      void refetchDetail()
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل الإغلاق', tone: 'error' })
    }
  }

  const handleCancel = async () => {
    if (!selectedId) return
    const ok = await dialog.confirm({ title: 'إلغاء التسوية', message: 'سيتم إلغاء التسوية المفتوحة وإعادة الأرصدة. متابعة؟', confirmLabel: 'إلغاء', tone: 'error' })
    if (!ok) return
    try {
      await cancelMut.mutateAsync({ id: selectedId, body: {} })
      toast.push({ title: 'تم إلغاء التسوية', tone: 'success' })
      void refetchDetail()
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل الإلغاء', tone: 'error' })
    }
  }

  const mutPending = [paymentMut, refundMut, adjustmentMut, discountMut, lateFeeMut, closeMut, cancelMut].some((m) => m.isPending)

  const modifierButtons: Array<{ key: Modifier; label: string; icon: React.ReactNode }> = [
    { key: 'payment', label: 'دفعة', icon: <Banknote size={12} /> },
    { key: 'refund', label: 'مردود', icon: <Receipt size={12} /> },
    { key: 'adjustment', label: 'تعديل', icon: <PlusCircle size={12} /> },
    { key: 'discount', label: 'خصم', icon: <Percent size={12} /> },
    { key: 'latefee', label: 'غرامة تأخير', icon: <Clock4 size={12} /> },
  ]

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Wallet className="text-primary" />
            التسويات
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            تسويات المبيعات والتأجير — تعرض القيم من الخادم دون حساب محلي
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 bg-base-300/40 p-4 rounded-xl border border-base-content/5 items-end">
        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50">بحث برقم التسوية</span>
          <input
            type="text"
            placeholder="رقم التسوية..."
            className="input input-bordered w-full bg-base-200"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0) }}
          />
        </div>
        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">النوع</span>
          <select className="select select-bordered w-full bg-base-200 text-xs" value={entityType} onChange={(e) => { setEntityType(e.target.value); setOffset(0) }}>
            <option value="">الكل</option>
            <option value="sale">بيع</option>
            <option value="rental">تأجير</option>
          </select>
        </div>
        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">الحالة</span>
          <select className="select select-bordered w-full bg-base-200 text-xs" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }}>
            <option value="">الكل</option>
            {SETTLEMENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1">
          {isLoading ? (
            <div className="flex flex-col gap-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-base-300/50 rounded-lg animate-pulse" />)}</div>
          ) : isError ? (
            <div className="alert alert-error text-xs flex gap-2"><AlertTriangle size={14} /><span>فشل التحميل.</span><button onClick={() => void refetch()} className="btn btn-ghost btn-xs"><RefreshCw size={12} /></button></div>
          ) : (data?.items ?? []).length === 0 ? (
            <div className="card bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl p-8 text-center text-xs text-base-content/40">لا توجد تسويات</div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {(data?.items ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-right p-3 rounded-xl border text-xs transition-colors ${
                    selectedId === s.id ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-300/40 hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold">{s.settlementNumber}</span>
                    <span className={`badge badge-xs ${STATUS_BADGE[s.status as SettlementStatus]}`}>{STATUS_LABELS[s.status as SettlementStatus]}</span>
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-base-content/50">
                    <span>{s.entityType === 'sale' ? (s.sale?.saleNumber ?? 'بيع') : (s.rental?.rentalNumber ?? 'تأجير')}</span>
                    <span className="font-mono text-base-content/60">{formatFils(s.totalFils)}</span>
                  </div>
                  <div className="flex justify-between mt-0.5 text-[10px]">
                    <span className="text-base-content/40">المتبقي</span>
                    <span className="font-mono font-bold text-error">{formatFils(s.remainingFils)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {(data?.items ?? []).length > 0 && (
            <div className="flex justify-between items-center pt-3">
              <span className="text-[10px] text-base-content/50">صفحة {page} من {totalPages}</span>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-square btn-xs" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}><ChevronRight size={14} /></button>
                <button className="btn btn-ghost btn-square btn-xs" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}><ChevronLeft size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!selectedId || !detail ? (
            <div className="card bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl p-10 text-center">
              <Wallet size={40} className="text-base-content/20 mx-auto mb-3" />
              <p className="font-bold text-base-content/50">اختر تسوية لعرض تفاصيلها</p>
              <p className="text-xs text-base-content/40 mt-1">كل القيم معروضة من الخادم — لا تُحسب أي تسوية في الواجهة</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card bg-base-300/40 border border-base-content/10 rounded-xl p-5">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg">{detail.settlementNumber}</span>
                      <span className={`badge badge-xs ${STATUS_BADGE[detail.status as SettlementStatus]}`}>{STATUS_LABELS[detail.status as SettlementStatus]}</span>
                      <span className="badge badge-xs badge-neutral">{detail.entityType === 'sale' ? 'بيع' : 'تأجير'}</span>
                    </div>
                    <div className="text-[10px] text-base-content/40 mt-1">
                      {detail.sale?.saleNumber ?? detail.rental?.rentalNumber ?? detail.entityId} · {formatDateTime(detail.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {canManage && ['open', 'partially_paid'].includes(detail.status) && modifierButtons.map((b) => {
                      const visible = b.key === 'adjustment' ? canAdjust : canManage
                      if (!visible) return null
                      if (b.key === 'payment') {
                        return (
                          <button key={b.key} onClick={() => setPaymentDialogOpen(true)} className="btn btn-xs gap-1 btn-primary">
                            {b.icon}{b.label}
                          </button>
                        )
                      }
                      return (
                        <button key={b.key} onClick={() => setModifier(b.key === modifier ? null : b.key)} className={`btn btn-xs gap-1 ${modifier === b.key ? 'btn-primary' : 'btn-outline border-base-content/10'}`}>
                          {b.icon}{b.label}
                        </button>
                      )
                    })}
                    {canManage && detail.status === 'paid' && (
                      <button onClick={() => void handleClose()} disabled={mutPending} className="btn btn-xs btn-success gap-1"><Lock size={12} /> إغلاق</button>
                    )}
                    {canManage && detail.status === 'open' && (
                      <button onClick={() => void handleCancel()} disabled={mutPending} className="btn btn-xs btn-error gap-1"><XCircle size={12} /> إلغاء</button>
                    )}
                  </div>
                </div>

                {/* Modifier form */}
                    {modifier && (
                      <div className="mt-4 border-t border-base-content/5 pt-4 space-y-3">
                        <span className="text-[10px] text-base-content/50 font-semibold">
                          {modifier === 'refund' ? 'تسجيل مردود' : modifier === 'adjustment' ? 'تعديل (قيمة موجبة تزيد)' : modifier === 'discount' ? 'خصم ثابت' : 'غرامة تأخير ثابتة'}
                        </span>
                        {modifier !== 'latefee' && (
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="المبلغ (د.ع)"
                            className="input input-bordered input-sm w-44 bg-base-200 font-mono"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        )}
                        {modifier === 'latefee' && (
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="الغرامة (د.ع)"
                            className="input input-bordered input-sm w-44 bg-base-200 font-mono"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        )}
                        <input
                          type="text"
                          placeholder="السبب (اختياري)"
                          className="input input-bordered input-sm flex-1 bg-base-200"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => void handleModifierSubmit()} disabled={mutPending} className="btn btn-primary btn-sm">
                            {mutPending ? <span className="loading loading-spinner loading-xs" /> : 'تنفيذ'}
                          </button>
                          <button onClick={dismiss} className="btn btn-ghost btn-sm">إلغاء</button>
                        </div>
                      </div>
                    )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <Stat label="الرسوم" value={formatFils(detail.chargeFils)} />
                  <Stat label="التأمين" value={formatFils(detail.depositFils)} />
                  <Stat label="الغرامات" value={formatFils(detail.lateFeeFils)} />
                  <Stat label="الخصم" value={formatFils(detail.discountFils)} />
                  <Stat label="التعديل" value={formatFils(detail.adjustmentFils)} />
                  <Stat label="المردود" value={formatFils(detail.refundFils)} />
                  <Stat label="الإجمالي" value={formatFils(detail.totalFils)} strong />
                  <Stat label="المدفوع" value={formatFils(detail.paidFils)} strong />
                </div>
                <div className="mt-3 flex justify-between items-center p-3 bg-base-200/50 rounded-lg">
                  <span className="text-xs font-bold text-base-content/70">المتبقي المستحق</span>
                  <span className="font-mono font-black text-error text-lg">{formatFils(detail.remainingFils)}</span>
                </div>
              </div>

              {/* History */}
              <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
                <div className="p-4 border-b border-base-content/5 font-bold text-sm">السجل</div>
                <ul className="p-4 space-y-2">
                  {(detail.history ?? []).length === 0 && <li className="text-xs text-base-content/40">لا يوجد سجل</li>}
                  {(detail.history ?? []).map((h) => (
                    <li key={h.id} className="flex justify-between text-xs border-b border-base-content/5 pb-2">
                      <span>
                        <span className="font-bold">{h.action}</span>
                        {h.amountFils != null ? <span className="font-mono text-base-content/60"> · {formatFils(h.amountFils)}</span> : null}
                        {h.reason ? <span className="text-base-content/50"> — {h.reason}</span> : null}
                      </span>
                      <span className="font-mono text-base-content/40 text-[10px]">{formatDateTime(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedId && detail && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          targetLabel={`تسوية ${detail.settlementNumber}`}
          subtitle={detail.account?.customer?.fullName}
          remainingFils={detail.remainingFils}
          defaultAmountFils={detail.remainingFils > 0 ? detail.remainingFils : undefined}
          title="تسجيل دفعة"
          onSubmit={async ({ amountFils, method, notes, idempotencyKey }) => {
            try {
              await paymentMut.mutateAsync({ id: selectedId, body: { amountFils, method, notes, idempotencyKey } })
              setPaymentDialogOpen(false)
              void refetchDetail()
              return { ok: true }
            } catch (err) {
              return { ok: false, error: err instanceof Error ? err.message : 'فشل تسجيل الدفعة' }
            }
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-base-200/40 rounded-lg p-3">
      <div className="text-[10px] text-base-content/50">{label}</div>
      <div className={`font-mono mt-0.5 ${strong ? 'font-black text-primary' : 'font-bold text-base-content/80'}`}>{value}</div>
    </div>
  )
}
