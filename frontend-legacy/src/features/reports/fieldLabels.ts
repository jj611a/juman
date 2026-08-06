import type { FinancialSummaryReportDto } from '@/services/domainTypes'

export const FINANCIAL_METRIC_LABELS: Record<keyof FinancialSummaryReportDto, string> = {
  date_from: 'date_from',
  date_to: 'date_to',
  rental_charges_gross: '\u0625\u062c\u0645\u0627\u0644\u064a \u0631\u0633\u0648\u0645 \u0627\u0644\u0625\u064a\u062c\u0627\u0631 (rental_charges_gross)',
  rental_charges_rental: '\u0631\u0633\u0648\u0645 \u0627\u0644\u0625\u064a\u062c\u0627\u0631 (rental_charges_rental)',
  rental_charges_late: '\u063a\u0631\u0627\u0645\u0627\u062a \u0627\u0644\u062a\u0623\u062e\u064a\u0631 (rental_charges_late)',
  rental_charges_minor_damage: '\u063a\u0631\u0627\u0645\u0627\u062a \u0627\u0644\u0623\u0636\u0631\u0627\u0631 \u0627\u0644\u0628\u0633\u064a\u0637\u0629 (rental_charges_minor_damage)',
  rental_adjustments: '\u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a \u0627\u0644\u064a\u062f\u0648\u064a\u0629 (rental_adjustments)',
  rental_initial_credits: '\u062f\u0641\u0639\u0627\u062a \u0623\u0648\u0644\u064a\u0629 \u0643\u0631\u0635\u064a\u062f (rental_initial_credits)',
  rental_payments_collected: '\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0627\u0644\u0625\u064a\u062c\u0627\u0631 \u0627\u0644\u0645\u062d\u0635\u0651\u0644\u0629 (rental_payments_collected)',
  rental_outstanding: '\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u0633\u062a\u062d\u0642 (rental_outstanding)',
  sale_revenue: 'sale_revenue',
  sale_revenue_normal: 'sale_revenue_normal',
  sale_revenue_mandatory: 'sale_revenue_mandatory',
  sale_payments_collected: 'sale_payments_collected',
  total_cash_collected: 'total_cash_collected',
  total_charged: 'total_charged'
}

export const FINANCIAL_DAILY_SERIES = [
  { key: 'total_cash_collected', label: FINANCIAL_METRIC_LABELS.total_cash_collected },
  { key: 'total_charged', label: FINANCIAL_METRIC_LABELS.total_charged },
  { key: 'sale_revenue', label: FINANCIAL_METRIC_LABELS.sale_revenue },
  { key: 'rental_payments_collected', label: FINANCIAL_METRIC_LABELS.rental_payments_collected }
] as const

export const SALES_SUMMARY_MONEY_KEYS = [
  'sale_revenue',
  'sale_revenue_normal',
  'sale_revenue_mandatory'
] as const
