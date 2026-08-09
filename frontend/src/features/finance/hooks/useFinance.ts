import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  financeApi,
  type ListAccountsQuery,
  type ListTransactionsQuery,
  type ListPaymentsQuery,
  type CreateFinancePaymentPayload,
} from '../api/api'

export const financeKeys = {
  all: ['finance'] as const,
  accounts: (q?: ListAccountsQuery) => ['finance', 'accounts', q ?? {}] as const,
  transactions: (q?: ListTransactionsQuery) => ['finance', 'transactions', q ?? {}] as const,
  payments: (q?: ListPaymentsQuery) => ['finance', 'payments', q ?? {}] as const,
  outstanding: (scope: { accountId?: string; customerId?: string }) =>
    ['finance', 'outstanding', scope] as const,
}

export function useAccounts(query?: ListAccountsQuery) {
  return useQuery({
    queryKey: financeKeys.accounts(query),
    queryFn: () => financeApi.listAccounts(query),
    placeholderData: (prev) => prev,
  })
}

export function useTransactions(query?: ListTransactionsQuery) {
  return useQuery({
    queryKey: financeKeys.transactions(query),
    queryFn: () => financeApi.listTransactions(query),
    placeholderData: (prev) => prev,
    enabled: Boolean(query?.accountId || query?.customerId),
  })
}

export function usePayments(query?: ListPaymentsQuery) {
  return useQuery({
    queryKey: financeKeys.payments(query),
    queryFn: () => financeApi.listPayments(query),
    placeholderData: (prev) => prev,
    enabled: Boolean(query?.accountId || query?.customerId),
  })
}

export function useOutstanding(scope: { accountId?: string; customerId?: string }) {
  return useQuery({
    queryKey: financeKeys.outstanding(scope),
    queryFn: () => financeApi.getOutstanding(scope),
    enabled: Boolean(scope.accountId || scope.customerId),
    retry: false,
  })
}

export function useCreateFinancePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFinancePaymentPayload) => financeApi.createPayment(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['settlements'] })
      void queryClient.invalidateQueries({ queryKey: ['customerOutstanding'] })
      void queryClient.invalidateQueries({ queryKey: ['customerPayments'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
