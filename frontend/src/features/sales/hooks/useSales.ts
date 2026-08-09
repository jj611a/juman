import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  salesApi,
  type SaleDto,
  type CreateSalePayload,
  type SalePaymentPayload,
} from '@/features/pos/api/salesApi'

export const saleKeys = {
  all: ['sales'] as const,
  list: (query?: Record<string, unknown>) => ['sales', 'list', query ?? {}] as const,
  detail: (id: string) => ['sales', 'detail', id] as const,
  history: (id: string) => ['sales', 'history', id] as const,
}

export function useSalesList(query?: Record<string, unknown>) {
  return useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () => salesApi.list(query),
    placeholderData: (prev) => prev,
  })
}

export function useSaleDetail(id: string) {
  return useQuery({
    queryKey: saleKeys.detail(id),
    queryFn: () => salesApi.getById(id),
    enabled: Boolean(id),
  })
}

export function useSaleHistory(id: string) {
  return useQuery({
    queryKey: saleKeys.history(id),
    queryFn: () => salesApi.history(id),
    enabled: Boolean(id),
  })
}

/** Invalidate the financial/report surfaces that a sale completion affects. */
export function invalidateAfterSale(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: saleKeys.all })
  void queryClient.invalidateQueries({ queryKey: ['settlements'] })
  void queryClient.invalidateQueries({ queryKey: ['finance'] })
  void queryClient.invalidateQueries({ queryKey: ['reports'] })
  void queryClient.invalidateQueries({ queryKey: ['items'] })
  void queryClient.invalidateQueries({ queryKey: ['customers'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSalePayload) => salesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
    },
  })
}

export function useConfirmSale(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body?: { reason?: string; customerId?: string }) =>
      salesApi.confirm(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: saleKeys.history(id) })
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['settlements'] })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
      void queryClient.invalidateQueries({ queryKey: ['customerOutstanding'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export function useSalePayment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SalePaymentPayload) => salesApi.payment(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: saleKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['settlements'] })
      void queryClient.invalidateQueries({ queryKey: ['finance'] })
      void queryClient.invalidateQueries({ queryKey: ['customerOutstanding'] })
      void queryClient.invalidateQueries({ queryKey: ['customerPayments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

export function useCompleteSale(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body?: { reason?: string; paymentAmountFils?: number; paymentMethod?: string }) =>
      salesApi.complete(id, body),
    onSuccess: (sale: SaleDto) => {
      invalidateAfterSale(queryClient)
      void queryClient.invalidateQueries({ queryKey: saleKeys.detail(sale.id) })
      void queryClient.invalidateQueries({ queryKey: saleKeys.history(sale.id) })
    },
  })
}

export function useCancelSale(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body?: { reason?: string }) => salesApi.cancel(id, body),
    onSuccess: (sale: SaleDto) => {
      invalidateAfterSale(queryClient)
      void queryClient.invalidateQueries({ queryKey: saleKeys.detail(sale.id) })
      void queryClient.invalidateQueries({ queryKey: saleKeys.history(sale.id) })
    },
  })
}
