import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import InventoryListPage from '@/features/inventory/pages/InventoryListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const categoriesListMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    dresses: {
      list: (...args: unknown[]) => listMock(...args),
      getByBarcode: vi.fn()
    },
    categories: {
      list: (...args: unknown[]) => categoriesListMock(...args)
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
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={<InventoryListPage />} />
          <Route path="/inventory/:id" element={<div>detail</div>} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('InventoryListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    categoriesListMock.mockReset()
    categoriesListMock.mockResolvedValue({ success: true, data: [], meta: { offset: 0, limit: 200, total: 0 } })
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'd1',
          barcode: 'JM-001',
          category_id: 'c1',
          name_ar: 'فستان سهرة',
          name_en: null,
          brand: null,
          size: 'M',
          colour: 'BLACK',
          purchase_price: 100000,
          default_daily_rental_price: 25000,
          default_sale_price: 200000,
          description: null,
          purchase_date: null,
          status: 'AVAILABLE',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ],
      meta: { page: 1, page_size: 20, total: 1, pages: 1 }
    })
  })

  it('loads dresses via apiClient with page params', async () => {
    renderPage(['inventory.view', 'inventory.create', 'inventory.delete'])
    expect(await screen.findByText('فستان سهرة')).toBeInTheDocument()
    expect(screen.getByText('JM-001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
    const args = listMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.page).toBe(1)
    expect(args.page_size).toBe(20)
  })

  it('hides create without inventory.create', async () => {
    renderPage(['inventory.view'])
    await screen.findByText('فستان سهرة')
    expect(screen.queryByRole('button', { name: 'فستان جديد' })).not.toBeInTheDocument()
  })

  it('redirects without inventory.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
