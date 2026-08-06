import { useQuery } from '@tanstack/react-query'
import type { FinanceListParams } from '@/services/domainTypes'
import { financeApi, financeKeys } from './api'

export function useFinanceAccounts(params?: FinanceListParams) {
  return useQuery({
    queryKey: financeKeys.accounts(params),
    queryFn: () => financeApi.listAccounts(params)
  })
}

export function useFinanceTransactions(params?: FinanceListParams) {
  return useQuery({
    queryKey: financeKeys.transactions(params),
    queryFn: () => financeApi.listTransactions(params)
  })
}

export function useFinancePayments(params?: FinanceListParams) {
  return useQuery({
    queryKey: financeKeys.payments(params),
    queryFn: () => financeApi.listPayments(params)
  })
}

export function useFinanceOutstanding(
  params: { accountId?: string; customerId?: string } = {},
  options?: { enabled?: boolean }
) {
  const enabled =
    options?.enabled ?? Boolean(params.accountId || params.customerId)
  return useQuery({
    queryKey: financeKeys.outstanding(params),
    queryFn: () => financeApi.getOutstanding(params),
    enabled
  })
}
