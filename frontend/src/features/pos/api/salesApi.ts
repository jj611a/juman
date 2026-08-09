import { apiInvoke } from '@/ipc/api'

export interface SaleItemDto {
  id: string
  itemId: string
  priceFils?: number
  discountFils?: number
  quantity?: number
  barcode?: string
  totalFils?: number
  barcodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  item?: {
    id: string
    internalCode: string
    displayName: string
    status?: string
    lifecycleState?: string
    salePrice?: number | null
  } | null
}

export interface SaleDto {
  id: string
  saleNumber: string
  customerId?: string | null
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled'
  subtotalFils: number
  discountFils: number
  taxFils: number
  totalFils: number
  notes?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  customer?: {
    id: string
    customerNumber: string
    fullName: string
    phone: string
  } | null
  items?: SaleItemDto[]
  settlement?: {
    id: string
    settlementNumber: string
    status: string
    totalFils: number
    paidFils: number
    remainingFils: number
    customerId: string
    accountId: string
  } | null
  history?: Array<{
    id: string
    oldStatus: string
    newStatus: string
    action: string
    reason?: string | null
    userId?: string | null
    username?: string | null
    createdAt: string
  }>
  createdBy?: string | null
  updatedBy?: string | null
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
  list(query?: Record<string, unknown>): Promise<{ items: SaleDto[]; meta: { total: number; offset: number; limit: number } }> {
    return apiInvoke({ method: 'GET', path: '/sales', query })
  },

  getById(id: string): Promise<SaleDto> {
    return apiInvoke({ method: 'GET', path: `/sales/${id}` })
  },

  history(id: string): Promise<SaleDto['history']> {
    return apiInvoke({ method: 'GET', path: `/sales/${id}/history` })
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
