import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { useAssignRolePermissions } from '@/features/roles/hooks'

const assignMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    roles: {
      assignPermissions: (...args: unknown[]) => assignMock(...args)
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

describe('useAssignRolePermissions', () => {
  beforeEach(() => {
    assignMock.mockReset()
    assignMock.mockResolvedValue({ success: true, total: 1, items: [] })
  })

  it('posts permission_keys to assign endpoint', async () => {
    const { result } = renderHook(() => useAssignRolePermissions('role1'), { wrapper })
    await result.current.mutateAsync({ permission_keys: ['sale.view'] })
    expect(assignMock).toHaveBeenCalledWith('role1', { permission_keys: ['sale.view'] })
  })
})
