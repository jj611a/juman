import { useState } from 'react'
import { useAccounts, useOutstanding, useTransactions, usePayments, useCreateFinancePayment } from '../hooks/useFinance'
import { useToast } from '@/app/providers/ToastProvider'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { formatFils, formatDateTime } from './financeUtils'
import { PaymentDialog } from '../components/PaymentDialog'
import { AlertTriangle, RefreshCw, Wallet, Search, Landmark, Banknote } from 'lucide-react'
import type { FinanceAccountDto } from '../api/api'

const TX_TYPE_LABELS: Record<string, string> = {
  rental_charge: 'رسم إيجار',
  deposit: 'تأمين',
  payment: 'دفعة',
  refund: 'مردود',
  adjustment: 'تعديل',
  discount: 'خصم',
  late_fee: 'غرامة تأخير',
  sale_charge: 'رسم بيع',
  sale_payment: 'دفعة بيع',
  sale_discount: 'خصم بيع',
  sale_adjustment: 'تعديل بيع',
  sale_refund: 'مردود بيع',
}

type Tab = 'outstanding' | 'payments' | 'transactions'

export function FinancePage() {
  const { can } = usePermission()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('outstanding')
  const [selectedAccount, setSelectedAccount] = useState<FinanceAccountDto | null>(null)
  const [payDialogOpen, setPayDialogOpen] = useState(false)

  const { data: accountsData, isLoading: accountsLoading, isError: accountsError, refetch: refetchAccounts } = useAccounts({
    q: q.trim() || undefined,
    limit: 50,
    sortBy: 'createdAt',
    sortDir: 'desc',
  })

  const { data: outstanding, isLoading: outstandingLoading, isError: outstandingError, refetch: refetchOutstanding } = useOutstanding(
    selectedAccount ? { accountId: selectedAccount.id } : {},
  )

  const { data: paymentsData } = usePayments(selectedAccount ? { accountId: selectedAccount.id, limit: 20 } : {})
  const { data: transactionsData } = useTransactions(selectedAccount ? { accountId: selectedAccount.id, limit: 20 } : {})

  const createPayment = useCreateFinancePayment()

  const canPay = can(PERMISSION.FINANCE_PAYMENT)

  /**
   * Standalone POST /finance/payments is rejected (409) by the backend while an
   * open/partial settlement exists on the account. We surface that honestly and
   * direct the user to record the payment inside the settlement instead.
   */
  const blockedByOpenSettlement = outstanding?.balanceSource === 'settlement'

  const handleDialogSubmit = async (payload: { amountFils: number; method: string; notes?: string; idempotencyKey: string }) => {
    if (!selectedAccount) return { ok: false, error: 'لم يُحدد حساب' }
    try {
      await createPayment.mutateAsync({
        accountId: selectedAccount.id,
        amountFils: payload.amountFils,
        method: payload.method,
        notes: payload.notes,
      })
      setPayDialogOpen(false)
      void refetchOutstanding()
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل تسجيل الدفعة'
      return { ok: false, error: message }
    }
  }

  const handlePrintReceipt = async () => {
    toast.push({ title: 'طباعة إيصال الدفعة غير متاحة بعد لهذه الصفحة', tone: 'info' })
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Landmark className="text-primary" />
            المالية
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            الحسابات والرصيد المستحق والدفعات والحركات المالية
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card bg-base-300/40 border border-base-content/10 rounded-xl p-4">
            <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2 mb-3">
              <Wallet size={14} className="text-primary" />
              الحسابات
            </h3>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="بحث عن عميل أو رقم حساب..."
                className="input input-bordered w-full bg-base-200 pl-10 input-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                <Search size={14} />
              </span>
            </div>
            {accountsLoading ? (
              <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-base-200/50 rounded-lg animate-pulse" />)}</div>
            ) : accountsError ? (
              <div className="alert alert-error text-xs flex gap-2 p-2">
                <AlertTriangle size={14} />
                <span>فشل تحميل الحسابات.</span>
                <button onClick={() => void refetchAccounts()} className="btn btn-ghost btn-xs"><RefreshCw size={12} /></button>
              </div>
            ) : (accountsData?.items ?? []).length === 0 ? (
              <div className="text-center py-8 text-base-content/40 text-xs">لا توجد حسابات</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {(accountsData?.items ?? []).map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccount(acc)}
                    className={`w-full text-right p-3 rounded-xl border transition-colors text-xs ${
                      selectedAccount?.id === acc.id
                        ? 'border-primary bg-primary/10'
                        : 'border-base-content/10 bg-base-200/40 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{acc.customer?.fullName ?? '—'}</span>
                      <span className="font-mono text-[9px] text-base-content/40">{acc.accountNumber}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-base-content/50 text-[10px]">الرصيد المستحق</span>
                      <span className="font-mono font-bold text-error">{formatFils(acc.outstandingFils)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail column */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedAccount ? (
            <div className="card bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl p-10 text-center">
              <Wallet size={40} className="text-base-content/20 mx-auto mb-3" />
              <p className="font-bold text-base-content/50">اختر حساباً لعرض الرصيد والدفعات</p>
              <p className="text-xs text-base-content/40 mt-1">الرصيد المستحق يتطلب اختيار حساب أو عميل — لا يُعرض بشكل عام</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="tabs tabs-boxed bg-base-300/40 w-fit">
                {(['outstanding', 'payments', 'transactions'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`tab tab-sm ${tab === t ? 'tab-active' : ''}`}
                  >
                    {t === 'outstanding' ? 'الرصيد' : t === 'payments' ? 'الدفعات' : 'الحركات'}
                  </button>
                ))}
              </div>

              {tab === 'outstanding' && (
                <div className="card bg-base-300/40 border border-base-content/10 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs text-base-content/50">الرصيد المستحق — {selectedAccount.accountNumber}</div>
                      <div className="text-2xl font-black text-error font-mono mt-1">
                        {outstandingLoading ? '...' : formatFils(outstanding?.outstandingFils)}
                      </div>
                      {outstanding?.balanceSource && (
                        <div className="text-[10px] text-base-content/40 mt-0.5">
                          المصدر: {outstanding.balanceSource === 'settlement' ? 'تسويات مفتوحة' : 'دفتر الحساب'}
                        </div>
                      )}
                    </div>
                    {outstandingError && (
                      <div className="alert alert-error text-[10px] p-2">تعذر استعلام الرصيد</div>
                    )}
                  </div>
                  {canPay && (
                    <div className="border-t border-base-content/5 pt-3 space-y-2">
                      {blockedByOpenSettlement && (
                        <div className="alert alert-warning text-[10px] p-2 flex gap-2 items-start">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>
                            يوجد تسوية مفتوحة لهذا الحساب — الخادم يرفض دفعة مستقلة.
                            سجّل الدفعة من صفحة <b>التسويات</b>.
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-base-content/50 font-semibold">تسجيل دفعة</span>
                        <button onClick={() => setPayDialogOpen(true)} disabled={createPayment.isPending} className="btn btn-primary btn-sm gap-1">
                          <Banknote size={12} />
                          دفعة جديدة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'payments' && (
                <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
                  <div className="p-4 border-b border-base-content/5 font-bold text-sm">الدفعات</div>
                  {(paymentsData?.items ?? []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-base-content/40">لا توجد دفعات</div>
                  ) : (
                    <table className="table table-sm w-full">
                      <thead><tr className="text-[10px] text-base-content/50"><th>الرقم</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                      <tbody>
                        {(paymentsData?.items ?? []).map((p) => (
                          <tr key={p.id} className="border-b border-base-content/5">
                            <td className="font-mono">{p.paymentNumber}</td>
                            <td className="font-mono font-bold">{formatFils(p.amountFils)}</td>
                            <td className="text-xs">{p.method}</td>
                            <td><span className={`badge badge-xs ${p.status === 'completed' ? 'badge-success' : 'badge-ghost'}`}>{p.status}</span></td>
                            <td className="font-mono text-[10px]">{formatDateTime(p.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'transactions' && (
                <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
                  <div className="p-4 border-b border-base-content/5 font-bold text-sm">الحركات المالية</div>
                  {(transactionsData?.items ?? []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-base-content/40">لا توجد حركات</div>
                  ) : (
                    <table className="table table-sm w-full">
                      <thead><tr className="text-[10px] text-base-content/50"><th>النوع</th><th>المبلغ</th><th>الوصف</th><th>التاريخ</th></tr></thead>
                      <tbody>
                        {(transactionsData?.items ?? []).map((t) => (
                          <tr key={t.id} className="border-b border-base-content/5">
                            <td><span className="badge badge-xs badge-neutral">{TX_TYPE_LABELS[t.type] ?? t.type}</span></td>
                            <td className={`font-mono font-bold ${t.outstandingDeltaFils >= 0 ? 'text-error' : 'text-success'}`}>
                              {t.outstandingDeltaFils >= 0 ? '+' : ''}{formatFils(t.amountFils)}
                            </td>
                            <td className="text-xs text-base-content/60 truncate max-w-[220px]">{t.description ?? '—'}</td>
                            <td className="font-mono text-[10px]">{formatDateTime(t.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedAccount && canPay && (
        <PaymentDialog
          open={payDialogOpen}
          onClose={() => setPayDialogOpen(false)}
          targetLabel={`حساب ${selectedAccount.accountNumber}`}
          subtitle={selectedAccount.customer?.fullName}
          remainingFils={outstanding?.outstandingFils ?? 0}
          defaultAmountFils={outstanding?.outstandingFils && outstanding.outstandingFils > 0 ? outstanding.outstandingFils : undefined}
          title="تسجيل دفعة"
          onSubmit={handleDialogSubmit}
          onPrintReceipt={() => void handlePrintReceipt()}
        />
      )}
    </div>
  )
}
