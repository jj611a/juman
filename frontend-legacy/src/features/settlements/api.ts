import { apiClient } from '@/services/apiClient'
import type {
  SettlementAdjustmentCreateBody,
  SettlementCreateBody,
  SettlementListParams,
  SettlementPaymentCreateBody
} from '@/services/domainTypes'

export const settlementKeys = {
  all: ['settlements'] as const,
  lists: () => [...settlementKeys.all, 'list'] as const,
  list: (params: SettlementListParams) => [...settlementKeys.lists(), params] as const,
  details: () => [...settlementKeys.all, 'detail'] as const,
  detail: (id: string) => [...settlementKeys.details(), id] as const,
  byRental: (rentalId: string) => [...settlementKeys.all, 'rental', rentalId] as const,
  audit: (id: string) => [...settlementKeys.detail(id), 'audit'] as const
}

export const settlementsApi = {
  list: (params?: SettlementListParams) => apiClient.settlements.list(params),
  get: (id: string) => apiClient.settlements.get(id),
  getByRental: (rentalId: string) => apiClient.settlements.getByRental(rentalId),
  create: (body: SettlementCreateBody) => apiClient.settlements.create(body),
  collectPayment: (id: string, body: SettlementPaymentCreateBody) =>
    apiClient.settlements.collectPayment(id, body),
  adjust: (id: string, body: SettlementAdjustmentCreateBody) =>
    apiClient.settlements.adjust(id, body),
  refund: (id: string, body: { amountFils: number; reason: string; idempotencyKey?: string }) =>
    apiClient.settlements.refund(id, body),
  discount: (id: string, body: Record<string, unknown>) => apiClient.settlements.discount(id, body),
  lateFee: (id: string, body: Record<string, unknown>) => apiClient.settlements.lateFee(id, body),
  close: (id: string, body?: { reason?: string }) => apiClient.settlements.close(id, body),
  cancel: (id: string, body?: { reason?: string }) => apiClient.settlements.cancel(id, body),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'RentalSettlement', entity_id: id, limit: 50 })
}
