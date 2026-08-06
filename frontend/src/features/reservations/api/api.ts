import { apiInvoke } from '@/ipc/api'

export interface ReservationItemDto {
  itemId: string
  barcode?: string
  agreedRentalPrice?: number
  notes?: string
  item?: {
    id: string
    displayName: string
    internalCode: string
  }
}

export interface ReservationDto {
  id: string
  reservationNumber: string
  customerId: string
  startDate: string
  expectedCheckoutDate: string
  expectedReturnDate: string
  status: 'draft' | 'confirmed' | 'checked_out' | 'completed' | 'cancelled' | 'expired'
  notes?: string | null
  createdAt: string
  updatedAt: string
  customer?: {
    id: string
    fullName: string
    phone: string
  }
  items?: ReservationItemDto[]
}

export interface ListReservationsQuery {
  q?: string
  status?: string
  customerId?: string
  reservationNumber?: string
  deleted?: string
  sortBy?: string
  sortDir?: string
  offset?: number
  limit?: number
}

export interface PaginatedReservations {
  data: ReservationDto[]
  total: number
}

export interface CreateReservationPayload {
  customerId: string
  startDate: string
  expectedCheckoutDate: string
  expectedReturnDate: string
  notes?: string
  items: Array<{
    itemId: string
    barcode?: string
    agreedRentalPrice?: number
    notes?: string
  }>
}

export const reservationsApi = {
  list(query: ListReservationsQuery): Promise<PaginatedReservations> {
    return apiInvoke({ method: 'GET', path: '/reservations', query: query as any })
  },

  getById(id: string): Promise<ReservationDto> {
    return apiInvoke({ method: 'GET', path: `/reservations/${id}` })
  },

  create(body: CreateReservationPayload): Promise<ReservationDto> {
    return apiInvoke({ method: 'POST', path: '/reservations', body })
  },

  checkout(id: string, reason?: string, depositAmountFils?: number): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/reservations/${id}/checkout`, body: { reason, depositAmountFils } })
  },

  cancel(id: string, reason?: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/reservations/${id}/cancel`, body: { reason } })
  },

  expire(id: string, reason?: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/reservations/${id}/expire`, body: { reason } })
  }
}
