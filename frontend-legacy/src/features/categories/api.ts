import { apiClient } from '@/services/apiClient'
import type {
  CategoryCreateBody,
  CategoryListParams,
  CategoryUpdateBody
} from '@/services/domainTypes'

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (params: CategoryListParams) => [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const
}

export const categoriesApi = {
  list: (params?: CategoryListParams) => apiClient.categories.list(params),
  get: (id: string) => apiClient.categories.get(id),
  create: (body: CategoryCreateBody) => apiClient.categories.create(body),
  update: (id: string, body: CategoryUpdateBody) => apiClient.categories.update(id, body),
  remove: (id: string) => apiClient.categories.remove(id),
  activate: (id: string) => apiClient.categories.activate(id),
  deactivate: (id: string) => apiClient.categories.deactivate(id)
}
