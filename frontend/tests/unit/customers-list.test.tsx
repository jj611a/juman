import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import CustomersListPage from '@/features/customers/pages/CustomersListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    customers: {
      list: (...args: unknown[]) => listMock(...args),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn()
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
      <MemoryRouter initialEntries={['/customers']}>
        <Routes>
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/:id" element={<div>detail</div>} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CustomersListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'u1',
          customer_number: 'CUS-00000001',
          full_name: 'سارة أحمد',
          phone: '+9647701234567',
          alternative_phone: null,
          address: null,
          national_id: null,
          notes: null,
          gender: null,
          birth_date: null,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads customers via apiClient', async () => {
    renderPage(['customer.view', 'customer.create', 'customer.delete'])
    expect(await screen.findByText('سارة أحمد')).toBeInTheDocument()
    expect(screen.getByText('CUS-00000001')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })

  it('hides create without customer.create', async () => {
    renderPage(['customer.view'])
    await screen.findByText('سارة أحمد')
    expect(screen.queryByRole('button', { name: 'عميل جديد' })).not.toBeInTheDocument()
  })

  it('redirects without customer.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
