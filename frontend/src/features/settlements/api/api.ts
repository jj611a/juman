import { apiInvoke } from '@/ipc/api'

export const SETTLEMENT_STATUS_VALUES = ['open', 'partially_paid', 'paid', 'cancelled', 'closed'] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUS_VALUES)[number]

export interface SettlementDto {
  id: string
  settlementNumber: string
  entityType: 'rental' | 'sale'
  entityId: string
  rentalId?: string | null
  saleId?: string | null
  accountId: string
  customerId: string
  chargeFils: number
  depositFils: number
  lateFeeFils: number
  adjustmentFils: number
  discountFils: number
  refundFils: number
  totalFils: number
  paidFils: number
  remainingFils: number
  status: string
  currency: string
  notes?: string | null
  closedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  account?: {
    id: string
    accountNumber: string
    customer?: { id: string; fullName: string; phone: string } | null
  } | null
  sale?: {
    id: string
    saleNumber: string
    status?: string
  } | null
  rental?: {
    id: string
    rentalNumber: string
    status?: string
  } | null
  payments?: Array<{
    id: string
    paymentNumber: string
    amountFils: number
    method: string
    status: string
    createdAt: string
  }>
  refunds?: Array<{ id: string; amountFils: number; reason?: string | null; status: string; createdAt: string }>
  adjustments?: Array<{ id: string; amountFils: number; reason?: string | null; status: string; createdAt: string }>
  discounts?: Array<{ id: string; computedFils: number; reason?: string | null; status: string; createdAt: string }>
  lateFees?: Array<{ id: string; computedFils: number; reason?: string | null; status: string; createdAt: string }>
  history?: Array<{ id: string; oldStatus?: string; newStatus?: string; action: string; amountFils?: number | null; reason?: string | null; createdAt: string }>
}

export interface PaginatedSettlements {
  items: SettlementDto[]
  meta: { total: number; offset: number; limit: number }
}

export interface ListSettlementsQuery {
  q?: string
  entityType?: string
  status?: string
  customerId?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface SettlementPaymentPayload {
  amountFils: number
  method?: string
  notes?: string
  idempotencyKey?: string
}

export interface SettlementRefundPayload {
  amountFils: number
  reason: string
  idempotencyKey?: string
}

export interface SettlementAdjustmentPayload {
  amountFils: number
  reason: string
  idempotencyKey?: string
}

export interface SettlementDiscountPayload {
  kind: 'percentage' | 'fixed'
  basis?: 'rental' | 'settlement'
  percentBps?: number
  amountFils?: number
  reason: string
  idempotencyKey?: string
}

export interface SettlementLateFeePayload {
  kind: 'flat' | 'daily'
  flatFils?: number
  dailyFils?: number
  daysCharged?: number
  maxFils?: number
  reason: string
  idempotencyKey?: string
}

export const settlementsApi = {
  list(query?: ListSettlementsQuery): Promise<PaginatedSettlements> {
    return apiInvoke({ method: 'GET', path: '/settlements', query: query as Record<string, unknown> | undefined })
  },

  getById(id: string): Promise<SettlementDto> {
    return apiInvoke({ method: 'GET', path: `/settlements/${id}` })
  },

  payment(id: string, body: SettlementPaymentPayload): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/payment`, body })
  },

  refund(id: string, body: SettlementRefundPayload): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/refund`, body })
  },

  adjustment(id: string, body: SettlementAdjustmentPayload): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/adjustment`, body })
  },

  discount(id: string, body: SettlementDiscountPayload): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/discount`, body })
  },

  lateFee(id: string, body: SettlementLateFeePayload): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/late-fee`, body })
  },

  close(id: string): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/close`, body: {} })
  },

  cancel(id: string): Promise<SettlementDto> {
    return apiInvoke({ method: 'POST', path: `/settlements/${id}/cancel`, body: {} })
  },
}
