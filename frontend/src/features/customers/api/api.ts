import { apiInvoke } from '@/ipc/api'

export interface CustomerDto {
  id: string
  customerNumber: string
  fullName: string
  phone: string
  secondaryPhone?: string | null
  address?: string | null
  city?: string | null
  nationalId?: string | null
  gender?: string | null
  birthDate?: string | null
  notes?: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ListCustomersQuery {
  q?: string
  status?: string
  city?: string
  createdFrom?: string
  createdTo?: string
  deleted?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface PaginatedCustomers {
  data: CustomerDto[]
  total: number
}

export interface CreateCustomerPayload {
  fullName: string
  phone: string
  secondaryPhone?: string
  address?: string
  city?: string
  nationalId?: string
  gender?: string
  birthDate?: string
  notes?: string
  status?: string
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {}

export const customersApi = {
  list(query: ListCustomersQuery): Promise<PaginatedCustomers> {
    return apiInvoke({ method: 'GET', path: '/customers', query: query as any })
  },
  
  getById(id: string): Promise<CustomerDto> {
    return apiInvoke({ method: 'GET', path: `/customers/${id}` })
  },

  create(body: CreateCustomerPayload): Promise<CustomerDto> {
    return apiInvoke({ method: 'POST', path: '/customers', body })
  },

  update(id: string, body: UpdateCustomerPayload): Promise<CustomerDto> {
    return apiInvoke({ method: 'PATCH', path: `/customers/${id}`, body })
  },

  delete(id: string): Promise<void> {
    return apiInvoke({ method: 'DELETE', path: `/customers/${id}` })
  },

  restore(id: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/customers/${id}/restore` })
  },

  // Reports API integration
  getRentals(id: string): Promise<any[]> {
    return apiInvoke({ method: 'GET', path: `/reports/customers/${id}/rentals` })
  },

  getReservations(id: string): Promise<any[]> {
    return apiInvoke({ method: 'GET', path: `/reports/customers/${id}/reservations` })
  },

  getOutstanding(id: string): Promise<{ remainingFils: number }> {
    return apiInvoke({ method: 'GET', path: `/reports/customers/${id}/outstanding` })
  },

  getPayments(id: string): Promise<any[]> {
    return apiInvoke({ method: 'GET', path: `/reports/customers/${id}/payments` })
  }
}
