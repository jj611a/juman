import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import ReservationsListPage from '@/features/reservations/pages/ReservationsListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const customersList = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    reservations: {
      list: (...args: unknown[]) => listMock(...args),
      confirm: vi.fn(),
      cancel: vi.fn()
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
      <MemoryRouter initialEntries={['/reservations']}>
        <Routes>
          <Route path="/reservations" element={<ReservationsListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReservationsListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    customersList.mockReset()
    customersList.mockResolvedValue({ success: true, data: [], meta: { offset: 0, limit: 20, total: 0 } })
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'r1',
          reservation_number: 'RSV-00000001',
          customer_id: 'c1',
          reservation_at: '2026-07-01T00:00:00Z',
          rental_start_at: '2026-07-10T00:00:00Z',
          expected_return_at: '2026-07-12T00:00:00Z',
          status: 'DRAFT',
          notes: null,
          items: [{ id: 'i1', reservation_id: 'r1', dress_id: 'd1', reserved_daily_rental_price: 1000, notes: null, calendar_block_id: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' }],
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-01T00:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads reservations via apiClient with offset/limit', async () => {
    renderPage(['reservation.view', 'reservation.create'])
    expect(await screen.findByText('RSV-00000001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
    const args = listMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.offset).toBe(0)
    expect(args.limit).toBe(20)
  })

  it('hides create without reservation.create', async () => {
    renderPage(['reservation.view'])
    await screen.findByText('RSV-00000001')
    expect(screen.queryByRole('button', { name: 'حجز جديد' })).not.toBeInTheDocument()
  })

  it('redirects without reservation.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
