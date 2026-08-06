import { apiInvoke } from '@/ipc/api'

export interface SaleItemDto {
  itemId: string
  priceFils?: number
  discountFils?: number
  quantity?: number
  barcode?: string
  item?: {
    id: string
    displayName: string
    internalCode: string
  }
}

export interface SaleDto {
  id: string
  saleNumber: string
  customerId?: string | null
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
  discountFils: number
  taxFils: number
  createdAt: string
  updatedAt: string
  customer?: {
    id: string
    fullName: string
    phone: string
  } | null
  items?: SaleItemDto[]
  settlement?: {
    id: string
    totalFils: number
    paidFils: number
    status: string
  } | null
}

export interface CreateSalePayload {
  customerId?: string
  notes?: string
  discountFils?: number
  taxFils?: number
  items: Array<{
    itemId: string
    priceFils?: number
    discountFils?: number
    quantity?: number
    barcode?: string
  }>
}

export interface SalePaymentPayload {
  amountFils: number
  method: 'cash' | 'card' | 'bank_transfer'
  reference?: string
}

export const salesApi = {
  list(query: any): Promise<{ data: SaleDto[]; total: number }> {
    return apiInvoke({ method: 'GET', path: '/sales', query })
  },

  getById(id: string): Promise<SaleDto> {
    return apiInvoke({ method: 'GET', path: `/sales/${id}` })
  },

  create(body: CreateSalePayload): Promise<SaleDto> {
    return apiInvoke({ method: 'POST', path: '/sales', body })
  },

  confirm(id: string, body?: { reason?: string }): Promise<SaleDto> {
    return apiInvoke({ method: 'POST', path: `/sales/${id}/confirm`, body: body || {} })
  },

  payment(id: string, body: SalePaymentPayload): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/sales/${id}/payment`, body })
  },

  complete(id: string, body?: { reason?: string }): Promise<SaleDto> {
    return apiInvoke({ method: 'POST', path: `/sales/${id}/complete`, body: body || {} })
  },

  cancel(id: string, body?: { reason?: string }): Promise<SaleDto> {
    return apiInvoke({ method: 'POST', path: `/sales/${id}/cancel`, body: body || {} })
  }
}
