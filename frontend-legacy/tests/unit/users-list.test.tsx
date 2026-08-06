import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import UsersListPage from '@/features/users/pages/UsersListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const rolesList = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    users: { list: (...args: unknown[]) => listMock(...args) },
    roles: { list: (...args: unknown[]) => rolesList(...args) }
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
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/users" element={<UsersListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UsersListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    rolesList.mockReset()
    rolesList.mockResolvedValue({ success: true, total: 0, items: [] })
    listMock.mockResolvedValue({
      success: true,
      data: [{
        id: 'u1', username: 'cashier1', full_name: 'Cashier', phone: null, email: null,
        role_id: 'r1', is_active: true, is_locked: false, must_change_password: false,
        failed_login_attempts: 0, last_login_at: null, password_changed_at: null,
        created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z'
      }],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads users with users.view', async () => {
    renderPage(['users.view'])
    expect(await screen.findByText('cashier1')).toBeInTheDocument()
  })

  it('redirects without users perms', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
