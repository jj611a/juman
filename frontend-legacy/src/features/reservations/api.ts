import { apiClient } from '@/services/apiClient'
import type {
  ReservationCreateBody,
  ReservationListParams,
  ReservationUpdateBody
} from '@/services/domainTypes'

export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (params: ReservationListParams) => [...reservationKeys.lists(), params] as const,
  details: () => [...reservationKeys.all, 'detail'] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  audit: (id: string) => [...reservationKeys.detail(id), 'audit'] as const
}

export type ReservationCheckoutBody = {
  depositAmountFils?: number
  reason?: string
  idempotencyKey?: string
}

export const reservationsApi = {
  list: (params?: ReservationListParams) => apiClient.reservations.list(params),
  get: (id: string) => apiClient.reservations.get(id),
  create: (body: ReservationCreateBody) => apiClient.reservations.create(body),
  update: (id: string, body: ReservationUpdateBody) => apiClient.reservations.update(id, body),
  confirm: (id: string) => apiClient.reservations.confirm(id),
  cancel: (id: string) => apiClient.reservations.cancel(id),
  expire: (id: string) => apiClient.reservations.expire(id),
  checkout: (id: string, body?: ReservationCheckoutBody) =>
    apiClient.reservations.checkout(id, body),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'Reservation', entity_id: id, limit: 50 })
}
