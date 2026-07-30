import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import ReturnsListPage from '@/features/returns/pages/ReturnsListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const customersList = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    returns: {
      list: (...args: unknown[]) => listMock(...args)
    },
    customers: {
      list: (...args: unknown[]) => customersList(...args)
    }
  }
}))

function renderPage(permissions: string[]): void {
  useAuthStore.getState().setReady(true)
  useAuthStore.getState().setSession({
    authenticated: true,
    permissions,
    mustChangePassword: false,
    user: {
      id: '1',
      username: 'admin',
      full_name: 'Admin',
      role_id: 'r',
      is_active: true
    }
  })
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/returns']}>
        <Routes>
          <Route path="/returns" element={<ReturnsListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReturnsListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    customersList.mockReset()
    customersList.mockResolvedValue({
      success: true,
      data: [],
      meta: { offset: 0, limit: 20, total: 0 }
    })
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'ret1',
          return_number: 'RET-00000001',
          rental_id: 'r1',
          customer_id: 'c1',
          returned_at: '2026-07-20T00:00:00Z',
          status: 'PENDING_INSPECTION',
          returned_by: null,
          notes: null,
          items: [{ id: 'i1' }],
          created_at: '2026-07-20T00:00:00Z',
          updated_at: '2026-07-20T00:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads returns with return.view', async () => {
    renderPage(['return.view', 'return.create'])
    expect(await screen.findByText('RET-00000001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })

  it('redirects without return.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
