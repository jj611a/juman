import { apiClient } from '@/services/apiClient'
import type { RentalCreateBody, RentalListParams, RentalUpdateBody } from '@/services/domainTypes'

export type RentalActionBody = {
  depositAmountFils?: number
  reason?: string
  idempotencyKey?: string
}

export const rentalKeys = {
  all: ['rentals'] as const,
  lists: () => [...rentalKeys.all, 'list'] as const,
  list: (params: RentalListParams) => [...rentalKeys.lists(), params] as const,
  details: () => [...rentalKeys.all, 'detail'] as const,
  detail: (id: string) => [...rentalKeys.details(), id] as const,
  audit: (id: string) => [...rentalKeys.detail(id), 'audit'] as const
}

export const rentalsApi = {
  list: (params?: RentalListParams) => apiClient.rentals.list(params),
  get: (id: string) => apiClient.rentals.get(id),
  create: (body: RentalCreateBody) => apiClient.rentals.create(body),
  update: (id: string, body: RentalUpdateBody) => apiClient.rentals.update(id, body),
  checkout: (id: string, body?: RentalActionBody) => apiClient.rentals.checkout(id, body),
  return: (id: string, body?: { reason?: string; idempotencyKey?: string }) =>
    apiClient.rentals.return(id, body),
  complete: (id: string, body?: { reason?: string }) => apiClient.rentals.complete(id, body),
  cancel: (id: string, body?: { reason?: string }) => apiClient.rentals.cancel(id, body),
  audit: (id: string) => apiClient.rentals.audit(id)
}
