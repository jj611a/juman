import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import AuditListPage from '@/features/audit/pages/AuditListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    audit: { listLogs: (...args: unknown[]) => listMock(...args) }
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
      <MemoryRouter initialEntries={['/audit']}>
        <Routes>
          <Route path="/audit" element={<AuditListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AuditListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue({
      success: true,
      data: [{
        id: 'a1', module: 'sales', entity_type: 'Sale', entity_id: 's1', action: 'create',
        old_values: null, new_values: null, user_id: null, username: 'admin',
        ip_address: null, metadata: null, message: 'created', created_at: '2026-07-20T00:00:00Z'
      }],
      meta: { offset: 0, limit: 50, total: 1 }
    })
  })

  it('loads audit with audit.view', async () => {
    renderPage(['audit.view'])
    expect(listMock).toHaveBeenCalled()
    expect(await screen.findByText('sales')).toBeInTheDocument()
  })

  it('redirects without audit.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
