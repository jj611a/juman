import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  EmptyState,
  ErrorState,
  InlineMessage,
  MoneyDisplay,
  Page,
  PageHeader,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import {
  useFinanceAccounts,
  useFinanceOutstanding,
  useFinancePayments,
  useFinanceTransactions
} from '../hooks'
import {
  FINANCE_ACCOUNT_STATUS_MAP,
  FINANCE_PAYMENT_METHOD_LABELS,
  FINANCE_PAYMENT_STATUS_MAP,
  FINANCE_TX_STATUS_MAP,
  financeStatusKey,
  financeTxDescription,
  financeTxTypeLabel
} from '../labels'

export default function FinancePage(): React.ReactElement {
  const canView = useAnyPermission([
    'finance.view',
    'finance.payment',
    'finance.settlement.view'
  ])
  const [accountId, setAccountId] = React.useState<string>('')
  const [showVoided, setShowVoided] = React.useState(false)

  const accounts = useFinanceAccounts({ limit: 50, offset: 0 })
  const transactions = useFinanceTransactions({
    limit: 50,
    offset: 0,
    status: showVoided ? undefined : 'posted'
  })
  const payments = useFinancePayments({ limit: 50, offset: 0 })
  const outstanding = useFinanceOutstanding(accountId ? { accountId } : {})

  React.useEffect(() => {
    const first = accounts.data?.data?.[0]?.id
    if (!accountId && first) setAccountId(first)
  }, [accounts.data, accountId])

  if (!canView) return <Navigate to="/forbidden" replace />

  return (
    <Page size="lg" as="main">
      <PageHeader
        title="المالية"
        description="حسابات العملاء، دفتر الحركات، التحصيل، والمستحقات"
      />
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">الحسابات</TabsTrigger>
          <TabsTrigger value="transactions">دفتر الحركات</TabsTrigger>
          <TabsTrigger value="payments">التحصيل</TabsTrigger>
          <TabsTrigger value="outstanding">المستحق</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4 space-y-3">
          <InlineMessage variant="info">
            كل عميل له حساب مالي يجمع عليه رسوم الإيجار والدفعات والمستحق.
          </InlineMessage>
          {accounts.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : accounts.isError ? (
            <ErrorState title="تعذر التحميل" onRetry={() => void accounts.refetch()} />
          ) : (accounts.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="لا حسابات" description="تُنشأ الحسابات تلقائياً عند أول تأجير" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(accounts.data?.data ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{a.customer?.fullName ?? 'عميل'}</p>
                    <p className="text-caption text-muted-foreground" dir="ltr">
                      {a.accountNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip
                      status={financeStatusKey(a.status)}
                      map={FINANCE_ACCOUNT_STATUS_MAP}
                    />
                    {a.outstandingFils != null ? (
                      <div className="text-end">
                        <p className="text-caption text-muted-foreground">المستحق</p>
                        <MoneyDisplay value={a.outstandingFils} />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <InlineMessage variant="info">
              رسوم الإيجار تُسجَّل على العميل، والدفعة الأولية تُخصم منها. الملغى لا يدخل في المستحق.
            </InlineMessage>
            <label className="flex cursor-pointer items-center gap-2 text-caption">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
              />
              إظهار الحركات الملغاة
            </label>
          </div>
          {transactions.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : transactions.isError ? (
            <ErrorState title="تعذر التحميل" onRetry={() => void transactions.refetch()} />
          ) : (transactions.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              title={showVoided ? 'لا حركات' : 'لا حركات فعّالة'}
              description={showVoided ? undefined : 'فعّل «إظهار الحركات الملغاة» لعرض ما أُلغي مع التأجير'}
            />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(transactions.data?.data ?? []).map((t) => {
                const st = financeStatusKey(t.status)
                const voided = st === 'VOIDED'
                return (
                  <li
                    key={t.id}
                    className={
                      voided
                        ? 'flex flex-wrap justify-between gap-2 px-4 py-3 opacity-60'
                        : 'flex flex-wrap justify-between gap-2 px-4 py-3'
                    }
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{financeTxTypeLabel(t.type)}</p>
                        <StatusChip status={st} map={FINANCE_TX_STATUS_MAP} />
                      </div>
                      <p className="text-caption text-muted-foreground">
                        {financeTxDescription(t.description, t.type)}
                      </p>
                    </div>
                    <MoneyDisplay value={t.amountFils} />
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-3">
          <InlineMessage variant="info">
            التحصيل الفعلي من العميل (نقد / بطاقة / تحويل) — يختلف عن «الدفعة الأولية» المسجّلة عند التسليم.
          </InlineMessage>
          {payments.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : payments.isError ? (
            <ErrorState title="تعذر التحميل" onRetry={() => void payments.refetch()} />
          ) : (payments.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="لا تحصيلات بعد" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(payments.data?.data ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-medium" dir="ltr">
                      {p.paymentNumber}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip
                        status={financeStatusKey(p.status)}
                        map={FINANCE_PAYMENT_STATUS_MAP}
                      />
                      <span className="text-caption text-muted-foreground">
                        {FINANCE_PAYMENT_METHOD_LABELS[p.method ?? ''] ?? p.method ?? '—'}
                      </span>
                    </div>
                  </div>
                  <MoneyDisplay value={p.amountFils} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="outstanding" className="mt-4 space-y-3">
          <InlineMessage variant="info">
            المستحق = رسوم الإيجار − الدفعة الأولية − ما تم تحصيله (بعد استبعاد التأجيرات الملغاة).
          </InlineMessage>
          {(accounts.data?.data.length ?? 0) > 0 ? (
            <select
              className="select select-bordered w-full max-w-md"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="اختر حساب العميل"
            >
              {(accounts.data?.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.customer?.fullName ?? 'عميل'} — {a.accountNumber}
                </option>
              ))}
            </select>
          ) : null}
          {!accountId ? (
            <InlineMessage variant="info">اختر حساب عميل لعرض المستحق.</InlineMessage>
          ) : outstanding.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : outstanding.isError ? (
            <ErrorState title="تعذر تحميل المستحق" onRetry={() => void outstanding.refetch()} />
          ) : outstanding.data ? (
            <div className="rounded-md border border-border p-4 space-y-2">
              <p className="text-caption text-muted-foreground">إجمالي المستحق على الحساب</p>
              <p className="text-caption" dir="ltr">
                {outstanding.data.accountNumber}
              </p>
              <p className="text-lg font-medium">
                <MoneyDisplay value={outstanding.data.outstandingFils} />
              </p>
            </div>
          ) : (
            <EmptyState title="لا بيانات" />
          )}
        </TabsContent>
      </Tabs>
    </Page>
  )
}
