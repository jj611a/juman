import { apiClient } from '@/services/apiClient'
import type { FinanceListParams } from '@/services/domainTypes'

export const financeKeys = {
  all: ['finance'] as const,
  accounts: (params?: FinanceListParams) => [...financeKeys.all, 'accounts', params] as const,
  transactions: (params?: FinanceListParams) =>
    [...financeKeys.all, 'transactions', params] as const,
  payments: (params?: FinanceListParams) => [...financeKeys.all, 'payments', params] as const,
  outstanding: (params: { accountId?: string; customerId?: string }) =>
    [...financeKeys.all, 'outstanding', params] as const
}

export const financeApi = {
  listAccounts: (params?: FinanceListParams) => apiClient.finance.listAccounts(params),
  listTransactions: (params?: FinanceListParams) => apiClient.finance.listTransactions(params),
  listPayments: (params?: FinanceListParams) => apiClient.finance.listPayments(params),
  getOutstanding: (params: { accountId?: string; customerId?: string }) =>
    apiClient.finance.getOutstanding(params)
}
