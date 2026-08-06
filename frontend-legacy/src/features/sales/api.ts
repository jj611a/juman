import { apiClient } from '@/services/apiClient'
import type { SaleCreateBody, SaleListParams } from '@/services/domainTypes'

export const saleKeys = {
  all: ['sales'] as const,
  lists: () => [...saleKeys.all, 'list'] as const,
  list: (params: SaleListParams) => [...saleKeys.lists(), params] as const,
  details: () => [...saleKeys.all, 'detail'] as const,
  detail: (id: string) => [...saleKeys.details(), id] as const,
  audit: (id: string) => [...saleKeys.detail(id), 'audit'] as const
}

export const salesApi = {
  list: (params?: SaleListParams) => apiClient.sales.list(params),
  get: (id: string) => apiClient.sales.get(id),
  create: (body: SaleCreateBody) => apiClient.sales.create(body),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'Sale', entity_id: id, limit: 50 })
}
