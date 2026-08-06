import { apiClient } from '@/services/apiClient'
import type {
  ColorCreateBody,
  ColorListParams,
  ColorUpdateBody
} from '@/services/domainTypes'

export const colorKeys = {
  all: ['colors'] as const,
  lists: () => [...colorKeys.all, 'list'] as const,
  list: (params: ColorListParams) => [...colorKeys.lists(), params] as const
}

export const colorsApi = {
  list: (params?: ColorListParams) => apiClient.colors.list(params),
  get: (id: string) => apiClient.colors.get(id),
  create: (body: ColorCreateBody) => apiClient.colors.create(body),
  update: (id: string, body: ColorUpdateBody) => apiClient.colors.update(id, body),
  remove: (id: string) => apiClient.colors.remove(id)
}
