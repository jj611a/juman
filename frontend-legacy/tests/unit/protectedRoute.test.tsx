import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

describe('ProtectedRoute', () => {
  it('redirects when unauthenticated', () => {
    useAuthStore.setState({
      ready: true,
      session: { authenticated: false, permissions: [] }
    })
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>سري</div>} />
          </Route>
          <Route path="/login" element={<div>غير مصادق</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('غير مصادق')).toBeInTheDocument()
  })

  it('renders outlet when authenticated', () => {
    useAuthStore.setState({
      ready: true,
      session: {
        authenticated: true,
        permissions: [],
        user: { id: '1', username: 'admin', full_name: null, role_id: null, is_active: true }
      }
    })
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<div>سري</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('سري')).toBeInTheDocument()
  })
})
