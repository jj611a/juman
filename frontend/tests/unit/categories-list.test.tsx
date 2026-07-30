import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import CategoriesListPage from '@/features/categories/pages/CategoriesListPage'
import { useAuthStore } from '@/stores/authStore'

const listMock = vi.fn()
const createMock = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    categories: {
      list: (...args: unknown[]) => listMock(...args),
      get: vi.fn(),
      create: (...args: unknown[]) => createMock(...args),
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
      <MemoryRouter initialEntries={['/categories']}>
        <Routes>
          <Route path="/categories" element={<CategoriesListPage />} />
          <Route path="/forbidden" element={<div>forbidden-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CategoriesListPage', () => {
  beforeEach(() => {
    listMock.mockReset()
    createMock.mockReset()
    listMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'c1',
          name_ar: 'سهرة',
          name_en: 'Evening',
          description: null,
          display_order: 1,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 20, total: 1 }
    })
  })

  it('loads list rows via apiClient', async () => {
    renderPage(['categories.view', 'categories.create', 'categories.update', 'categories.delete'])
    expect(await screen.findByText('سهرة')).toBeInTheDocument()
    expect(listMock).toHaveBeenCalled()
  })

  it('hides create action without categories.create', async () => {
    renderPage(['categories.view'])
    await screen.findByText('سهرة')
    expect(screen.queryByRole('button', { name: 'فئة جديدة' })).not.toBeInTheDocument()
  })

  it('redirects to forbidden without categories.view', async () => {
    renderPage([])
    expect(await screen.findByText('forbidden-page')).toBeInTheDocument()
  })

  it('validates create form name_ar', async () => {
    const user = userEvent.setup()
    renderPage(['categories.view', 'categories.create'])
    await screen.findByText('سهرة')
    await user.click(screen.getByRole('button', { name: 'فئة جديدة' }))
    await user.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(await screen.findByText('الاسم بالعربية مطلوب')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })
})
