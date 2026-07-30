import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import CalendarDressPage from '@/features/calendar/pages/CalendarDressPage'
import { useAuthStore } from '@/stores/authStore'

const dressGet = vi.fn()
const timeline = vi.fn()
const availability = vi.fn()
const conflicts = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    dresses: {
      get: (...args: unknown[]) => dressGet(...args)
    },
    calendar: {
      timeline: (...args: unknown[]) => timeline(...args),
      availability: (...args: unknown[]) => availability(...args),
      conflicts: (...args: unknown[]) => conflicts(...args),
      createBlock: vi.fn(),
      updateBlock: vi.fn(),
      deleteBlock: vi.fn()
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
      <MemoryRouter initialEntries={['/calendar/d1']}>
        <Routes>
          <Route path="/calendar/:dressId" element={<CalendarDressPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CalendarDressPage', () => {
  beforeEach(() => {
    dressGet.mockReset()
    timeline.mockReset()
    availability.mockReset()
    conflicts.mockReset()
    dressGet.mockResolvedValue({
      success: true,
      data: {
        id: 'd1',
        barcode: 'JM-001',
        category_id: 'c1',
        name_ar: 'فستان سهرة',
        name_en: null,
        brand: null,
        size: 'M',
        colour: 'BLACK',
        purchase_price: 0,
        default_daily_rental_price: 0,
        default_sale_price: 0,
        description: null,
        purchase_date: null,
        status: 'AVAILABLE',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      }
    })
    timeline.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'b1',
          dress_id: 'd1',
          block_type: 'MAINTENANCE',
          reference_module: null,
          reference_id: null,
          start_at: '2026-07-01T00:00:00Z',
          end_at: '2026-07-03T00:00:00Z',
          notes: 'صيانة',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ]
    })
  })

  it('renders dress timeline blocks from calendar API', async () => {
    renderPage(['calendar.view', 'inventory.view'])
    expect(await screen.findByText(/تقويم · فستان سهرة/)).toBeInTheDocument()
    expect(await screen.findAllByText('صيانة')).not.toHaveLength(0)
    expect(timeline).toHaveBeenCalled()
    expect(dressGet).toHaveBeenCalledWith('d1')
  })

  it('redirects without calendar.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
