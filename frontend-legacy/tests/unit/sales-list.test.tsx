import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import SalesListPage from '@/features/sales/pages/SalesListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const customersList = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    sales: { list: (...args: unknown[]) => listMock(...args) },
    customers: { list: (...args: unknown[]) => customersList(...args) }
  }
}))

function renderPage(permissions: string[]): void {
  useAuthStore.getState().setReady(true)
  useAuthStore.getState().setSession({
    authenticated: true,
    permissions,
    mustChangePassword: false,
    user: { id: '1', username: 'admin', full_name: 'Admin', role_id: 'r', is_active: true }
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/sales']}>
        <Routes>
          <Route path="/sales" element={<SalesListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SalesListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    customersList.mockReset()
    customersList.mockResolvedValue({ success: true, data: [], meta: { offset: 0, limit: 20, total: 0 } })
    listMock.mockResolvedValue({
      success: true,
      data: [{
        id: 's1', sale_number: 'SAL-00000001', origin: 'NORMAL_SALE', status: 'COMPLETED',
        customer_id: null, rental_id: null, return_id: null, inspection_id: null,
        total_amount: 100000, sold_at: '2026-07-20T00:00:00Z', sold_by: null, notes: null,
        items: [], payments: [], created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z'
      }],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads sales with sale.view', async () => {
    renderPage(['sale.view', 'sale.create'])
    expect(await screen.findByText('SAL-00000001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })

  it('redirects without sale.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
