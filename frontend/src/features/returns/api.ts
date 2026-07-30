import { apiClient } from '@/services/apiClient'
import type { ReturnCreateBody, ReturnListParams } from '@/services/domainTypes'

export const returnKeys = {
  all: ['returns'] as const,
  lists: () => [...returnKeys.all, 'list'] as const,
  list: (params: ReturnListParams) => [...returnKeys.lists(), params] as const,
  details: () => [...returnKeys.all, 'detail'] as const,
  detail: (id: string) => [...returnKeys.details(), id] as const,
  audit: (id: string) => [...returnKeys.detail(id), 'audit'] as const
}

export const returnsApi = {
  list: (params?: ReturnListParams) => apiClient.returns.list(params),
  get: (id: string) => apiClient.returns.get(id),
  create: (body: ReturnCreateBody) => apiClient.returns.create(body),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'Return', entity_id: id, limit: 50 })
}