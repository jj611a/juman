import { apiClient } from '@/services/apiClient'
import type {
  BrandCreateBody,
  BrandListParams,
  BrandUpdateBody
} from '@/services/domainTypes'

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (params: BrandListParams) => [...brandKeys.lists(), params] as const
}

export const brandsApi = {
  list: (params?: BrandListParams) => apiClient.brands.list(params),
  get: (id: string) => apiClient.brands.get(id),
  create: (body: BrandCreateBody) => apiClient.brands.create(body),
  update: (id: string, body: BrandUpdateBody) => apiClient.brands.update(id, body),
  remove: (id: string) => apiClient.brands.remove(id)
}
