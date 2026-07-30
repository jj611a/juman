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
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'RentalSettlement', entity_id: id, limit: 50 })
}
