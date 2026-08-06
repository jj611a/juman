import * as React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import ReportsHomePage from '@/features/reports/pages/ReportsHomePage'
import { useAuthStore } from '@/stores/authStore'

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
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<ReportsHomePage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ReportsHomePage', () => {
  beforeEach(() => {})

  it('renders for reports.view', async () => {
    renderPage(['reports.view'])
    expect(await screen.findByText(/التقارير|Reports/i)).toBeInTheDocument()
  })

  it('redirects without reports perms', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })
})
