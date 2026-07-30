import * as React from 'react'
import { Navigate } from 'react-router'
import { filsToDisplay, IQD } from '@/lib/money/currency'
import {
  BusyIndicator,
  EmptyState,
  ErrorState,
  Grid,
  KPICard,
  MoneyDisplay,
  Page,
  PageHeader
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { ReportAreaChart } from '../components/charts/ReportAreaChart'
import { ReportLineChart } from '../components/charts/ReportLineChart'
import { ReportChrome } from '../components/ReportChrome'
import { FINANCIAL_DAILY_SERIES, FINANCIAL_METRIC_LABELS } from '../fieldLabels'
import {
  useFinancialDailyReport,
  useFinancialSummaryReport,
  useReportDateRange
} from '../hooks'

const MONEY_METRIC_KEYS = [
  'rental_charges_gross',
  'rental_charges_rental',
  'rental_charges_late',
  'rental_charges_minor_damage',
  'rental_adjustments',
  'rental_initial_credits',
  'rental_payments_collected',
  'rental_outstanding',
  'sale_revenue',
  'sale_revenue_normal',
  'sale_revenue_mandatory',
  'sale_payments_collected',
  'total_cash_collected',
  'total_charged'
] as const

function moneyTick(value: number): string {
  return `${filsToDisplay(value, IQD)} ${IQD.symbol}`
}

export default function FinancialReportPage(): React.ReactElement {
  const canView = usePermission('reports.financial.view')
  const { from, to, setFrom, setTo, params, isValid } = useReportDateRange()
  const summary = useFinancialSummaryReport(params, canView && isValid)
  const daily = useFinancialDailyReport(params, canView && isValid)

  if (!canView) return <Navigate to="/forbidden" replace />

  const summaryData = summary.data
  const chartData = daily.data?.days ?? []

  return (
    <Page size="full" as="main">
      <PageHeader
        title="التقرير المالي"
        description="المقاييس المسماة من financial/summary — بدون حسابات محلية."
      />
      <ReportChrome
        dateFrom={from}
        dateTo={to}
        onDateFromChange={(d) => d && setFrom(d)}
        onDateToChange={(d) => d && setTo(d)}
      >
        {!isValid ? (
          <EmptyState title="نطاق تاريخ غير صالح" />
        ) : summary.isLoading || daily.isLoading ? (
          <BusyIndicator label="جاري التحميل…" />
        ) : summary.isError ? (
          <ErrorState title="تعذر تحميل الملخص المالي" onRetry={() => void summary.refetch()} />
        ) : daily.isError ? (
          <ErrorState title="تعذر تحميل financial/daily" onRetry={() => void daily.refetch()} />
        ) : summaryData ? (
          <div className="space-y-8">
            <Grid cols={3} gap={4}>
              {MONEY_METRIC_KEYS.map((key) => (
                <KPICard
                  key={key}
                  title={FINANCIAL_METRIC_LABELS[key]}
                  value={<MoneyDisplay value={summaryData[key]} />}
                />
              ))}
            </Grid>

            <section className="space-y-2">
              <h3 className="text-title text-foreground">
                financial/daily ({daily.data?.timezone ?? '—'}) — sparse days[]
              </h3>
              {chartData.length === 0 ? (
                <EmptyState title="لا أيام في days[]" description="لا zero-fill — عرض فقط ما يُرجعه الخادم." />
              ) : (
                <>
                  <ReportLineChart
                    data={chartData}
                    xKey="day"
                    series={FINANCIAL_DAILY_SERIES.map((s) => ({
                      key: s.key,
                      label: s.label
                    }))}
                    yFormatter={moneyTick}
                  />
                  <ReportAreaChart
                    data={chartData}
                    xKey="day"
                    series={[
                      {
                        key: 'total_cash_collected',
                        label: FINANCIAL_METRIC_LABELS.total_cash_collected
                      },
                      {
                        key: 'total_charged',
                        label: FINANCIAL_METRIC_LABELS.total_charged
                      }
                    ]}
                    yFormatter={moneyTick}
                  />
                </>
              )}
            </section>
          </div>
        ) : null}
      </ReportChrome>
    </Page>
  )
}
