import { apiClient } from '@/services/apiClient'
import type {
  SizeCreateBody,
  SizeListParams,
  SizeUpdateBody
} from '@/services/domainTypes'

export const sizeKeys = {
  all: ['sizes'] as const,
  lists: () => [...sizeKeys.all, 'list'] as const,
  list: (params: SizeListParams) => [...sizeKeys.lists(), params] as const
}

export const sizesApi = {
  list: (params?: SizeListParams) => apiClient.sizes.list(params),
  get: (id: string) => apiClient.sizes.get(id),
  create: (body: SizeCreateBody) => apiClient.sizes.create(body),
  update: (id: string, body: SizeUpdateBody) => apiClient.sizes.update(id, body),
  remove: (id: string) => apiClient.sizes.remove(id)
}
