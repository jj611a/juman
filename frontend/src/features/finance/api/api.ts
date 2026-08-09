import { apiInvoke } from '@/ipc/api'

export interface FinanceAccountDto {
  id: string
  accountNumber: string
  customerId: string
  customer?: {
    id: string
    customerNumber: string
    fullName: string
    status?: string
  } | null
  currency: string
  status: string
  notes?: string | null
  outstandingFils: number | null
  outstandingMajor?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface FinanceTransactionDto {
  id: string
  accountId: string
  type: string
  amountFils: number
  amountMajor?: string | null
  status: string
  referenceType?: string | null
  referenceId?: string | null
  description?: string | null
  outstandingDeltaFils: number
  createdAt: string
  updatedAt: string
  createdBy?: string | null
}

export interface FinancePaymentDto {
  id: string
  paymentNumber: string
  accountId: string
  transactionId?: string | null
  amountFils: number
  amountMajor?: string | null
  status: string
  method: string
  notes?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
}

export interface OutstandingDto {
  accountId: string
  accountNumber: string
  customerId: string
  currency: string
  outstandingFils: number
  outstandingMajor: string
  balanceSource: 'settlement' | 'ledger'
}

export interface PaginatedFinance<T> {
  items: T[]
  meta: { total: number; offset: number; limit: number }
}

export interface ListAccountsQuery {
  q?: string
  customerId?: string
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface ListTransactionsQuery {
  accountId?: string
  customerId?: string
  type?: string
  referenceType?: string
  referenceId?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface ListPaymentsQuery {
  accountId?: string
  customerId?: string
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface CreateFinancePaymentPayload {
  accountId: string
  amountFils: number
  settlementId?: string
  method?: string
  notes?: string
}

export const financeApi = {
  listAccounts(query?: ListAccountsQuery): Promise<PaginatedFinance<FinanceAccountDto>> {
    return apiInvoke({ method: 'GET', path: '/finance/accounts', query: query as Record<string, unknown> | undefined })
  },

  listTransactions(query?: ListTransactionsQuery): Promise<PaginatedFinance<FinanceTransactionDto>> {
    return apiInvoke({ method: 'GET', path: '/finance/transactions', query: query as Record<string, unknown> | undefined })
  },

  listPayments(query?: ListPaymentsQuery): Promise<PaginatedFinance<FinancePaymentDto>> {
    return apiInvoke({ method: 'GET', path: '/finance/payments', query: query as Record<string, unknown> | undefined })
  },

  /**
   * Outstanding REQUIRES accountId OR customerId (backend rule). The UI must
   * always provide one — it never calls this without a scope.
   */
  getOutstanding(query: { accountId?: string; customerId?: string }): Promise<OutstandingDto> {
    if (!query.accountId && !query.customerId) {
      return Promise.reject(new Error('accountId أو customerId مطلوب لاستعلام الرصيد'))
    }
    return apiInvoke({ method: 'GET', path: '/finance/outstanding', query: query as Record<string, unknown> })
  },

  createPayment(body: CreateFinancePaymentPayload): Promise<FinancePaymentDto> {
    return apiInvoke({ method: 'POST', path: '/finance/payments', body })
  },
}
