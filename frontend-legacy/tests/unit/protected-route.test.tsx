import * as React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from '@/app/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().setReady(true)
  })

  it('redirects unauthenticated users to login', () => {
    useAuthStore.getState().setSession({
      authenticated: false,
      permissions: [],
      mustChangePassword: false
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>login-screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('login-screen')).toBeInTheDocument()
  })

  it('redirects mustChangePassword to force-password-change', () => {
    useAuthStore.getState().setSession({
      authenticated: true,
      permissions: [],
      mustChangePassword: true,
      user: {
        id: '1',
        username: 'u',
        full_name: 'U',
        role_id: 'r',
        is_active: true
      }
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/force-password-change" element={<div>force-pw</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('force-pw')).toBeInTheDocument()
  })
})
