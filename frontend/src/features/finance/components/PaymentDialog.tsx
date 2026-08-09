import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/app/providers/ToastProvider'
import { formatIQD, toFils, IQD_LABEL, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES } from '@/shared/utils/money'
import { Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react'

export interface PaymentDialogSubmitResult {
  ok: boolean
  error?: string
}

export interface PaymentDialogProps {
  open: boolean
  onClose: () => void
  /** Human label of what is being paid (settlement/account/sale). */
  targetLabel: string
  /** Remaining/outstanding amount in fils — used for display + overpayment guard. */
  remainingFils: number
  /** Default amount (fils) to prefill, e.g. the full remaining. */
  defaultAmountFils?: number
  /** Title shown in the dialog header. */
  title?: string
  /** Extra context line (e.g. customer name / account number). */
  subtitle?: string
  /** Allowed methods — only the backend-supported set. */
  methods?: readonly string[]
  /** Submit handler; must reject on backend failure. */
  onSubmit: (payload: {
    amountFils: number
    method: string
    notes?: string
    idempotencyKey: string
  }) => Promise<PaymentDialogSubmitResult>
  /** Optional callback invoked after a successful submit (e.g. print receipt). */
  onPrintReceipt?: () => void | Promise<void>
  /** Optional label for the print action. */
  printLabel?: string
  /** Optional disable of the print action (e.g. no receipt data available). */
  printDisabled?: boolean
}

/**
 * Production payment dialog used across Finance / Settlements / Sales / Customers.
 * Amounts are integer fils; the dialog works in IQD (د.ع). Overpayment is blocked
 * client-side AND enforced server-side by the settlement engine (422).
 * Never mutates money without the user confirming submit.
 */
export function PaymentDialog({
  open,
  onClose,
  targetLabel,
  remainingFils,
  defaultAmountFils,
  title = 'تسجيل دفعة',
  subtitle,
  methods = PAYMENT_METHOD_VALUES,
  onSubmit,
  onPrintReceipt,
  printLabel = 'طباعة الإيصال',
  printDisabled = false,
}: PaymentDialogProps) {
  const toast = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>(methods[0] ?? 'cash')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const amountFils = useMemo(() => {
    const raw = Number(amount)
    if (!amount || Number.isNaN(raw) || raw <= 0) return 0
    return toFils(raw)
  }, [amount])

  const overpaid = amountFils > remainingFils
  const invalid = amountFils <= 0 || overpaid

  useEffect(() => {
    if (open) {
      setError(null)
      setSuccess(false)
      setSubmitting(false)
      setAmount(defaultAmountFils && defaultAmountFils > 0 ? String(defaultAmountFils / 1000) : '')
      setMethod(methods[0] ?? 'cash')
      setNotes('')
      queueMicrotask(() => dialogRef.current?.showModal())
    } else {
      dialogRef.current?.close()
    }
  }, [open, defaultAmountFils, methods])

  const close = () => {
    if (submitting) return
    dialogRef.current?.close()
    onClose()
  }

  const handleSubmit = async () => {
    if (invalid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await onSubmit({
        amountFils,
        method,
        notes: notes.trim() || undefined,
        idempotencyKey: `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      if (!result.ok) {
        setError(result.error ?? 'فشلت العملية')
        return
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدفعة')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="modal" onCancel={(e) => { e.preventDefault(); close() }}>
      <div className="modal-box border border-base-content/10 bg-base-200 max-w-md">
        <div className="flex items-center justify-between border-b border-base-content/5 pb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="text-primary">{title}</span>
          </h3>
          <button type="button" onClick={close} disabled={submitting} className="btn btn-ghost btn-sm btn-circle" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        <div className="py-3">
          <div className="bg-base-300/60 border border-base-content/10 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-base-content/60 text-xs">{targetLabel}</span>
              {subtitle ? <span className="text-xs text-base-content/40">{subtitle}</span> : null}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-base-content/60">المتبقي المستحق</span>
              <span className={`font-mono font-black ${remainingFils > 0 ? 'text-error' : 'text-success'}`}>
                {formatIQD(remainingFils)}
              </span>
            </div>
          </div>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 size={40} className="text-success mx-auto" />
            <p className="font-bold">تم تسجيل الدفعة بنجاح</p>
            {onPrintReceipt && (
              <button
                type="button"
                onClick={() => { void onPrintReceipt(); close() }}
                disabled={printDisabled}
                className="btn btn-primary btn-sm gap-2"
              >
                <Printer size={14} />
                {printLabel}
              </button>
            )}
            <div className="flex justify-center">
              <button type="button" onClick={close} className="btn btn-ghost btn-sm">إغلاق</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); void handleSubmit() }}
            className="space-y-4"
          >
            {error && (
              <div className="alert alert-error text-xs p-2 flex gap-2 items-start" role="alert">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <div className="flex justify-between items-center mb-1">
                <span className="label-text text-xs text-base-content/60 font-semibold">المبلغ ({IQD_LABEL})</span>
                {remainingFils > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(remainingFils / 1000))}
                    className="btn btn-ghost btn-xs text-primary"
                  >
                    تسديد كامل المبلغ
                  </button>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                placeholder="0.000"
                className="input input-bordered w-full bg-base-300 font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step="0.001"
              />
              {overpaid && (
                <span className="text-[10px] text-error mt-1">المبلغ يتجاوز المتبقي المستحق</span>
              )}
              {amountFils > 0 && !overpaid && (
                <span className="text-[10px] text-base-content/50 mt-1 font-mono">
                  {formatIQD(amountFils)} سيُسجل
                </span>
              )}
            </div>

            <div className="form-control">
              <span className="label-text text-xs text-base-content/60 font-semibold mb-1">طريقة الدفع</span>
              <div className="join w-full">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`join-item btn btn-sm flex-1 ${method === m ? 'btn-primary' : 'btn-outline border-base-content/10'}`}
                  >
                    {PAYMENT_METHOD_LABELS[m] ?? m}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-control">
              <span className="label-text text-xs text-base-content/60 font-semibold mb-1">ملاحظات (اختياري)</span>
              <input
                type="text"
                placeholder="سبب الدفعة أو ملاحظة..."
                className="input input-bordered w-full bg-base-300 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="modal-action">
              <button type="button" onClick={close} disabled={submitting} className="btn btn-ghost">إلغاء</button>
              <button type="submit" disabled={invalid || submitting} className="btn btn-primary gap-2">
                {submitting ? <span className="loading loading-spinner loading-xs" /> : 'تأكيد الدفعة'}
              </button>
            </div>
          </form>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={close}>close</button>
      </form>
    </dialog>
  )
}

/** Convenience hook wrapper so callers can toast on dialog errors. */
export function usePaymentError() {
  const toast = useToast()
  return (err: unknown) => {
    if (err instanceof Error) toast.push({ title: err.message, tone: 'error' })
  }
}
