import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { useCollectSettlementPayment } from '@/features/settlements/hooks'

const collectMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    settlements: {
      collectPayment: (...args: unknown[]) => collectMock(...args)
    }
  }
}))

vi.mock('@/lib/errors/appError', () => ({
  guardOnline: () => true,
  toastAppError: vi.fn()
}))

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCollectSettlementPayment', () => {
  beforeEach(() => {
    collectMock.mockReset()
    collectMock.mockResolvedValue({ success: true, data: { id: 'st1', remaining_balance: 0 } })
  })

  it('posts payment payload to API', async () => {
    const { result } = renderHook(() => useCollectSettlementPayment('st1'), { wrapper })
    await result.current.mutateAsync({
      amount: 1000,
      payment_method: 'CASH'
    })
    expect(collectMock).toHaveBeenCalledWith('st1', expect.objectContaining({ amount: 1000, payment_method: 'CASH' }))
  })
})
