import { apiInvoke } from '@/ipc/api'

export interface RentalItemDto {
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

export interface RentalDto {
  id: string
  rentalNumber: string
  customerId: string
  rentalDate: string
  expectedReturnDate: string
  actualReturnDate?: string | null
  status: 'draft' | 'checked_out' | 'active' | 'return_pending' | 'overdue' | 'completed' | 'cancelled'
  notes?: string | null
  createdAt: string
  updatedAt: string
  customer?: {
    id: string
    fullName: string
    phone: string
  }
  items?: RentalItemDto[]
  settlement?: {
    id: string
    totalFils: number
    paidFils: number
    status: string
  } | null
}

export interface ListRentalsQuery {
  q?: string
  status?: string
  customerId?: string
  rentalNumber?: string
  deleted?: string
  sortBy?: string
  sortDir?: string
  offset?: number
  limit?: number
}

export interface PaginatedRentals {
  items: RentalDto[]
  meta: { total: number; offset: number; limit: number }
}

export interface CreateRentalPayload {
  customerId: string
  rentalDate: string
  expectedReturnDate: string
  notes?: string
  items: Array<{
    itemId: string
    barcode?: string
    agreedRentalPrice?: number
    notes?: string
  }>
}

export interface UpdateRentalPayload {
  notes?: string
}

export const rentalsApi = {
  list(query: ListRentalsQuery): Promise<PaginatedRentals> {
    return apiInvoke({ method: 'GET', path: '/rentals', query: query as any })
  },

  getById(id: string): Promise<RentalDto> {
    return apiInvoke({ method: 'GET', path: `/rentals/${id}` })
  },

  create(body: CreateRentalPayload): Promise<RentalDto> {
    return apiInvoke({ method: 'POST', path: '/rentals', body })
  },

  update(id: string, body: UpdateRentalPayload): Promise<RentalDto> {
    return apiInvoke({ method: 'PATCH', path: `/rentals/${id}`, body })
  },

  checkout(id: string, reason?: string, depositAmountFils?: number): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/rentals/${id}/checkout`, body: { reason, depositAmountFils } })
  },

  return(id: string, reason?: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/rentals/${id}/return`, body: { reason } })
  },

  complete(id: string, reason?: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/rentals/${id}/complete`, body: { reason } })
  },

  cancel(id: string, reason?: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/rentals/${id}/cancel`, body: { reason } })
  }
}
