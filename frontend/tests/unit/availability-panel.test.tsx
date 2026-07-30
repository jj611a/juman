import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AvailabilityPanel } from '@/features/inventory/components/AvailabilityPanel'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    calendar: {
      availability: vi.fn(),
      conflicts: vi.fn()
    }
  }
}))

function renderPanel(permissions: string[]): void {
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
      <AvailabilityPanel dressId="d1" />
    </QueryClientProvider>
  )
}

describe('AvailabilityPanel', () => {
  it('gates on calendar.view', () => {
    renderPanel([])
    expect(screen.getByText('لا تملك صلاحية عرض التوفر')).toBeInTheDocument()
  })

  it('shows query UI when permitted (API-backed, no local math)', () => {
    renderPanel(['calendar.view'])
    expect(screen.getByText('توفر الفترة')).toBeInTheDocument()
    expect(screen.getByText(/النتيجة من واجهة التقويم فقط/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'استعلام' })).toBeDisabled()
  })
})
