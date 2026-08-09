import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  settlementsApi,
  type ListSettlementsQuery,
  type SettlementDto,
  type SettlementPaymentPayload,
  type SettlementRefundPayload,
  type SettlementAdjustmentPayload,
  type SettlementDiscountPayload,
  type SettlementLateFeePayload,
} from '../api/api'

export const settlementKeys = {
  all: ['settlements'] as const,
  list: (q?: ListSettlementsQuery) => ['settlements', 'list', q ?? {}] as const,
  detail: (id: string) => ['settlements', 'detail', id] as const,
}

export function useSettlementsList(query?: ListSettlementsQuery) {
  return useQuery({
    queryKey: settlementKeys.list(query),
    queryFn: () => settlementsApi.list(query),
    placeholderData: (prev) => prev,
  })
}

export function useSettlementDetail(id: string) {
  return useQuery({
    queryKey: settlementKeys.detail(id),
    queryFn: () => settlementsApi.getById(id),
    enabled: Boolean(id),
  })
}

function useSettlementMutation<TBody>(
  mutationFn: (id: string, body: TBody) => Promise<SettlementDto>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TBody }) => mutationFn(id, body),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: settlementKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: settlementKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['customerOutstanding'] })
      void queryClient.invalidateQueries({ queryKey: ['customerPayments'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['rentals'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export function useSettlementPayment() {
  return useSettlementMutation<SettlementPaymentPayload>(settlementsApi.payment)
}

export function useSettlementRefund() {
  return useSettlementMutation<SettlementRefundPayload>(settlementsApi.refund)
}

export function useSettlementAdjustment() {
  return useSettlementMutation<SettlementAdjustmentPayload>(settlementsApi.adjustment)
}

export function useSettlementDiscount() {
  return useSettlementMutation<SettlementDiscountPayload>(settlementsApi.discount)
}

export function useSettlementLateFee() {
  return useSettlementMutation<SettlementLateFeePayload>(settlementsApi.lateFee)
}

export function useSettlementClose() {
  return useSettlementMutation<Record<string, never>>(settlementsApi.close)
}

export function useSettlementCancel() {
  return useSettlementMutation<Record<string, never>>(settlementsApi.cancel)
}
