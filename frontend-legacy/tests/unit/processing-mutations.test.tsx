import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import {
  useUpdateInspection,
  useStartProcessingBatch,
  useCompleteProcessingBatch
} from '@/features/processing/hooks'

const updateMock = vi.fn()
const startMock = vi.fn()
const completeMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    inspections: {
      update: (...args: unknown[]) => updateMock(...args)
    },
    processing: {
      start: (...args: unknown[]) => startMock(...args),
      complete: (...args: unknown[]) => completeMock(...args)
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
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('inspection/processing mutations', () => {
  beforeEach(() => {
    updateMock.mockReset()
    startMock.mockReset()
    completeMock.mockReset()
    updateMock.mockResolvedValue({ success: true, data: { id: 'ins1', status: 'COMPLETED', items: [] } })
    startMock.mockResolvedValue({ success: true, data: { id: 'bat1', status: 'IN_PROCESS' } })
    completeMock.mockResolvedValue({ success: true, data: { id: 'bat1', status: 'COMPLETED' } })
  })

  it('sends complete:true on inspection update', async () => {
    const { result } = renderHook(() => useUpdateInspection('ins1'), { wrapper })
    await result.current.mutateAsync({
      items: [
        {
          id: 'item1',
          condition: 'GOOD',
          repair_penalty_amount: null,
          requires_laundry: false,
          send_to_ruined: false
        }
      ],
      complete: true
    })
    expect(updateMock).toHaveBeenCalledWith(
      'ins1',
      expect.objectContaining({ complete: true })
    )
  })

  it('start and complete processing call API', async () => {
    const start = renderHook(() => useStartProcessingBatch('bat1'), { wrapper })
    await start.result.current.mutateAsync({ enable_optional_day: false })
    expect(startMock).toHaveBeenCalledWith('bat1', { enable_optional_day: false })

    const complete = renderHook(() => useCompleteProcessingBatch('bat1'), { wrapper })
    await complete.result.current.mutateAsync()
    expect(completeMock).toHaveBeenCalledWith('bat1')
  })
})
