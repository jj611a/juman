import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useToast } from '@/app/providers/ToastProvider'
import { useDialog } from '@/app/providers/DialogProvider'
import {
  useSaleDetail,
  useSaleHistory,
  useConfirmSale,
  useSalePayment,
  useCompleteSale,
  useCancelSale,
} from '../hooks/useSales'
import { SALE_STATUS_LABELS, SALE_STATUS_BADGE, formatFils, formatDateTime } from '../constants/sales'
import { ROUTES } from '@/shared/constants/routes'
import { useReceiptSettings } from '@/features/receipts/hooks/useReceiptSettings'
import { useReceiptPrint } from '@/features/receipts/hooks/useReceiptPrint'
import { buildSaleReceipt } from '@/features/receipts/utils/receipt'
import { PaymentDialog } from '@/features/finance/components/PaymentDialog'
import { AlertTriangle, CheckCircle2, Printer, RotateCcw, XCircle, ArrowRight, Banknote } from 'lucide-react'

export function SalesDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { can } = usePermission()
  const toast = useToast()
  const dialog = useDialog()
  const { settings } = useReceiptSettings()
  const print = useReceiptPrint()

  const { data: sale, isLoading, isError } = useSaleDetail(id)
  const { data: history } = useSaleHistory(id)

  const confirmSale = useConfirmSale(id)
  const payment = useSalePayment(id)
  const completeSale = useCompleteSale(id)
  const cancelSale = useCancelSale(id)

  const [busy, setBusy] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)

  const remainingFils = sale?.settlement?.remainingFils ?? 0

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.push({ title: successMsg, tone: 'success' })
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'حدث خطأ', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    const ok = await dialog.confirm({
      title: 'تأكيد الفاتورة',
      message: 'سيتم إنشاء التسوية المالية وتثبيت القطع (للبيع). هل تريد المتابعة؟',
      confirmLabel: 'تأكيد الفاتورة',
    })
    if (!ok) return
    await run(() => confirmSale.mutateAsync({}), 'تم تأكيد الفاتورة')
  }

  const handleDialogSubmit = async (payload: { amountFils: number; method: string; notes?: string; idempotencyKey: string }) => {
    try {
      await payment.mutateAsync({
        amountFils: payload.amountFils,
        method: payload.method as 'cash' | 'card' | 'bank_transfer',
      })
      setPayDialogOpen(false)
      toast.push({ title: 'تم تسجيل الدفعة', tone: 'success' })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'فشل تسجيل الدفعة' }
    }
  }

  const handleComplete = async () => {
    const ok = await dialog.confirm({
      title: 'إكمال الفاتورة',
      message: 'سيتم تحويل القطع إلى حالة "مباع". هل تريد المتابعة؟',
      confirmLabel: 'إكمال البيع',
    })
    if (!ok) return
    await run(() => completeSale.mutateAsync({}), 'تم إكمال عملية البيع')
  }

  const handleCancel = async () => {
    const ok = await dialog.confirm({
      title: 'إلغاء الفاتورة',
      message: 'سيتم إلغاء الفاتورة وإعادة القطع المتاحة. لا يمكن التراجع بعد الدفع. متابعة؟',
      confirmLabel: 'إلغاء الفاتورة',
      tone: 'error',
    })
    if (!ok) return
    await run(() => cancelSale.mutateAsync({}), 'تم إلغاء الفاتورة')
  }

  const handlePrintReceipt = async () => {
    if (!sale) return
    const data = buildSaleReceipt(sale, settings, sale.createdBy ?? '')
    const ok = await print.print(data, settings)
    if (ok) toast.push({ title: 'تم إرسال الإيصال إلى الطابعة', tone: 'success' })
    else if (!print.lastResult?.cancelled) {
      toast.push({ title: print.error ?? 'فشل الطباعة', tone: 'error' })
    }
  }

  if (isLoading) {
    return <div className="flex flex-col gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 w-full bg-base-300/50 rounded-lg animate-pulse" />)}</div>
  }

  if (isError || !sale) {
    return (
      <div className="alert alert-error text-sm flex gap-2">
        <AlertTriangle size={18} />
        <span>تعذر تحميل بيانات الفاتورة.</span>
        <button onClick={() => navigate(ROUTES.SALES)} className="btn btn-sm btn-ghost">العودة للمبيعات</button>
      </div>
    )
  }

  const settled = Boolean(sale.settlement)

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <Link to={ROUTES.SALES} className="text-xs text-base-content/50 hover:text-primary flex items-center gap-1 mb-1">
            <ArrowRight size={12} />
            المبيعات
          </Link>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            فاتورة <span className="font-mono text-primary">{sale.saleNumber}</span>
          </h1>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {sale.status === 'draft' && can(PERMISSION.SALES_COMPLETE) && (
            <button onClick={() => void handleConfirm()} disabled={busy} className="btn btn-warning btn-sm gap-2">
              <CheckCircle2 size={14} />
              تأكيد الفاتورة
            </button>
          )}
          {sale.status === 'confirmed' && can(PERMISSION.SALES_PAYMENT) && (
            <button onClick={() => void handleComplete()} disabled={busy} className="btn btn-success btn-sm gap-2">
              <CheckCircle2 size={14} />
              إكمال البيع
            </button>
          )}
          {(sale.status === 'draft' || sale.status === 'confirmed') && can(PERMISSION.SALES_CANCEL) && (
            <button onClick={() => void handleCancel()} disabled={busy} className="btn btn-outline btn-error btn-sm gap-2">
              <XCircle size={14} />
              إلغاء الفاتورة
            </button>
          )}
          <button
            onClick={() => void handlePrintReceipt()}
            disabled={print.printing}
            className="btn btn-primary btn-sm gap-2"
          >
            {print.printing ? <span className="loading loading-spinner loading-xs" /> : <Printer size={14} />}
            طباعة الإيصال
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl">
          <span className="text-[10px] text-base-content/50">الحالة</span>
          <span className={`badge mt-1 w-fit badge-xs font-bold ${SALE_STATUS_BADGE[sale.status]}`}>
            {SALE_STATUS_LABELS[sale.status]}
          </span>
        </div>
        <div className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl">
          <span className="text-[10px] text-base-content/50">العميل</span>
          <span className="font-bold mt-1 text-sm truncate">{sale.customer?.fullName ?? 'زبون نقدي (Walk-in)'}</span>
        </div>
        <div className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl">
          <span className="text-[10px] text-base-content/50">الإجمالي</span>
          <span className="font-mono font-black mt-1 text-sm text-primary">{formatFils(sale.totalFils)}</span>
        </div>
        <div className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl">
          <span className="text-[10px] text-base-content/50">التاريخ</span>
          <span className="font-mono mt-1 text-xs">{formatDateTime(sale.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
            <div className="p-4 border-b border-base-content/5 font-bold text-sm">الأصناف</div>
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-[10px] text-base-content/50">
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الخصم</th>
                  <th className="text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(sale.items ?? []).map((line) => (
                  <tr key={line.id ?? line.itemId} className="border-b border-base-content/5">
                    <td>
                      <div className="font-bold text-xs">{line.itemNameSnapshot ?? line.item?.displayName}</div>
                      <div className="text-[10px] font-mono text-base-content/40">{line.item?.internalCode}</div>
                    </td>
                    <td className="text-xs">{line.quantity}</td>
                    <td className="font-mono text-xs">{formatFils(line.priceFils)}</td>
                    <td className="font-mono text-xs">{formatFils(line.discountFils)}</td>
                    <td className="text-left font-mono font-bold text-xs">{formatFils(line.totalFils)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="text-left text-xs text-base-content/60">المجموع الفرعي</td>
                  <td className="text-left font-mono font-bold text-xs">{formatFils(sale.subtotalFils)}</td>
                </tr>
                {sale.discountFils > 0 && (
                  <tr>
                    <td colSpan={4} className="text-left text-xs text-base-content/60">خصم الفاتورة</td>
                    <td className="text-left font-mono font-bold text-xs text-error">-{formatFils(sale.discountFils)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="text-left text-xs font-bold">الإجمالي</td>
                  <td className="text-left font-mono font-black text-primary">{formatFils(sale.totalFils)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
            <div className="p-4 border-b border-base-content/5 font-bold text-sm">سجل الفاتورة</div>
            <ul className="p-4 space-y-2">
              {(history ?? []).length === 0 && (
                <li className="text-xs text-base-content/40">لا يوجد سجل بعد.</li>
              )}
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex justify-between text-xs border-b border-base-content/5 pb-2">
                  <span>
                    <span className="font-bold">{h.action}</span>
                    {h.reason ? <span className="text-base-content/50"> — {h.reason}</span> : null}
                  </span>
                  <span className="font-mono text-base-content/40">{formatDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Settlement / payment column */}
        <div className="space-y-6">
          <div className="card bg-base-300/40 border border-base-content/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-3">التسوية المالية</div>
            {!settled ? (
              <div className="text-xs text-base-content/50 p-3 bg-base-200/40 rounded-lg">
                لم تُنشأ تسوية مالية بعد — قم بتأكيد الفاتورة أولاً.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span>رقم التسوية</span><span className="font-mono">{sale.settlement?.settlementNumber}</span></div>
                <div className="flex justify-between text-xs"><span>الإجمالي</span><span className="font-mono">{formatFils(sale.settlement?.totalFils)}</span></div>
                <div className="flex justify-between text-xs"><span>المدفوع</span><span className="font-mono text-success">{formatFils(sale.settlement?.paidFils)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span>المتبقي</span><span className="font-mono text-error">{formatFils(sale.settlement?.remainingFils)}</span></div>
              </div>
            )}

            {sale.status === 'confirmed' && can(PERMISSION.SALES_PAYMENT) && (
              <div className="mt-4 space-y-2 border-t border-base-content/5 pt-3">
                <button
                  onClick={() => setPayDialogOpen(true)}
                  disabled={busy || remainingFils <= 0}
                  className="btn btn-primary btn-sm w-full gap-2"
                >
                  <Banknote size={14} />
                  تسجيل دفعة
                </button>
              </div>
            )}
          </div>

          <div className="card bg-base-300/40 border border-base-content/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-2 flex items-center gap-2">
              <RotateCcw size={14} className="text-primary" />
              حالة القطع
            </div>
            <p className="text-[11px] text-base-content/50 leading-relaxed">
              عند تأكيد الفاتورة تُثبَّت القطع بحالة «للبيع» وتُنشأ التسوية. عند إكمال البيع تتحول القطع إلى «مُباع».
            </p>
          </div>
        </div>
      </div>

      {sale.settlement && (
        <PaymentDialog
          open={payDialogOpen}
          onClose={() => setPayDialogOpen(false)}
          targetLabel={`فاتورة ${sale.saleNumber}`}
          subtitle={sale.customer?.fullName}
          remainingFils={remainingFils}
          defaultAmountFils={remainingFils > 0 ? remainingFils : undefined}
          title="تسجيل دفعة"
          onSubmit={handleDialogSubmit}
          onPrintReceipt={() => void handlePrintReceipt()}
        />
      )}
    </div>
  )
}
