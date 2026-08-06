import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import RentalsListPage from '@/features/rentals/pages/RentalsListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const customersList = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    rentals: {
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
      <MemoryRouter initialEntries={['/rentals']}>
        <Routes>
          <Route path="/rentals" element={<RentalsListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RentalsListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    customersList.mockReset()
    customersList.mockResolvedValue({ success: true, data: [], meta: { offset: 0, limit: 20, total: 0 } })
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 't1',
          rental_number: 'RENT-00000001',
          customer_id: 'c1',
          reservation_id: null,
          rental_at: '2026-07-10T00:00:00Z',
          expected_return_at: '2026-07-12T00:00:00Z',
          status: 'ACTIVE',
          initial_payment_type: 'FIXED_AMOUNT',
          initial_payment_rate: null,
          initial_payment_value: 50000,
          estimated_total: 100000,
          remaining_balance: 50000,
          notes: null,
          items: [],
          created_at: '2026-07-10T00:00:00Z',
          updated_at: '2026-07-10T00:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads rentals and shows API totals', async () => {
    renderPage(['rental.view', 'rental.create'])
    expect(await screen.findByText('RENT-00000001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })

  it('redirects without rental.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
