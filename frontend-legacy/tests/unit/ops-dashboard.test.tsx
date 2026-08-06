import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/authStore'

const dashboardData = {
  timezone: 'Asia/Baghdad',
  as_of: '2026-07-30T10:00:00Z',
  today_from: '2026-07-30T00:00:00Z',
  today_to: '2026-07-31T00:00:00Z',
  dresses_total: 10,
  dresses_active: 8,
  dresses_by_status: { AVAILABLE: 5, RENTED: 3 },
  rentals_active: 3,
  rentals_due_today: 2,
  rentals_overdue: 1,
  reservations_today: 4,
  reservations_upcoming: 6,
  processing_batches_in_process: 1,
  dresses_in_processing: 2
}

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    reports: {
      dashboard: vi.fn()
    },
    system: {
      health: vi.fn(),
      version: vi.fn(),
      listBackups: vi.fn()
    },
    settings: {
      get: vi.fn()
    },
    audit: {
      listLogs: vi.fn()
    }
  }
}))

vi.mock('@/features/system/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/system/api')>('@/features/system/api')
  return {
    ...actual,
    systemApi: {
      ...actual.systemApi,
      health: vi.fn(),
      version: vi.fn(),
      listBackups: vi.fn()
    }
  }
})

vi.mock('@/features/reports/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/reports/api')>('@/features/reports/api')
  return {
    ...actual,
    reportsApi: {
      ...actual.reportsApi,
      dashboard: vi.fn()
    }
  }
})

vi.mock('@/features/settings/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/settings/api')>('@/features/settings/api')
  return {
    ...actual,
    settingsApi: {
      ...actual.settingsApi,
      get: vi.fn()
    }
  }
})

vi.mock('@/features/audit/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/audit/api')>('@/features/audit/api')
  return {
    ...actual,
    auditApi: {
      ...actual.auditApi,
      listLogs: vi.fn()
    }
  }
})

import OpsDashboardPage from '@/features/dashboard/pages/OpsDashboardPage'
import { reportsApi } from '@/features/reports/api'
import { systemApi } from '@/features/system/api'
import { settingsApi } from '@/features/settings/api'
import { auditApi } from '@/features/audit/api'

function renderDash(permissions: string[]): void {
  useAuthStore.getState().setReady(true)
  useAuthStore.getState().setSession({
    authenticated: true,
    permissions,
    mustChangePassword: false,
    user: { id: '1', username: 'admin', full_name: 'مدير النظام', role_id: 'r', is_active: true }
  })
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OpsDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OpsDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(reportsApi.dashboard).mockReset()
    vi.mocked(systemApi.health).mockReset()
    vi.mocked(systemApi.version).mockReset()
    vi.mocked(systemApi.listBackups).mockReset()
    vi.mocked(settingsApi.get).mockReset()
    vi.mocked(auditApi.listLogs).mockReset()

    vi.mocked(reportsApi.dashboard).mockResolvedValue(dashboardData)
    vi.mocked(systemApi.health).mockResolvedValue({
      status: 'ok',
      database: 'ok',
      redis: 'disabled'
    })
    vi.mocked(systemApi.version).mockResolvedValue({
      name: 'Juman',
      name_ar: 'جمان',
      version: '1.0.0',
      api: 'v1',
      environment: 'test'
    })
    vi.mocked(systemApi.listBackups).mockResolvedValue({
      success: true,
      data: [{ id: 'b1', status: 'completed', created_at: '2026-07-29T12:00:00Z' }],
      meta: { offset: 0, limit: 1, total: 1 }
    })
    vi.mocked(settingsApi.get).mockResolvedValue({
      id: 's1',
      key: 'company_name',
      value: 'جمان ستور',
      parsed_value: 'جمان ستور',
      value_type: 'string',
      category: 'company',
      description: null,
      is_editable: true,
      created_at: '',
      updated_at: '',
      created_by: null,
      updated_by: null
    })
    vi.mocked(auditApi.listLogs).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'a1',
          module: 'inventory',
          entity_type: 'dress',
          entity_id: 'd1',
          action: 'create',
          old_values: null,
          new_values: null,
          user_id: '1',
          username: 'admin',
          ip_address: null,
          metadata: null,
          message: 'created',
          created_at: '2026-07-30T09:00:00Z'
        }
      ],
      meta: { offset: 0, limit: 10, total: 1 }
    })
  })

  it('renders header and KPI titles with reports.view', async () => {
    renderDash([
      'reports.view',
      'settings.view',
      'system.view',
      'system.backup',
      'audit.view',
      'rental.view',
      'reservation.view',
      'processing.view',
      'reservation.create',
      'rental.create'
    ])
    expect(await screen.findByRole('main')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /مرحباً/ })).toBeInTheDocument()
    expect(await screen.findByText('تأجيرات نشطة')).toBeInTheDocument()
    expect(await screen.findByText('متاحة')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'عمل اليوم' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'إجراءات سريعة' })).toBeInTheDocument()
  })

  it('hides KPI section content call without reports.view', async () => {
    renderDash(['reservation.create'])
    const msgs = await screen.findAllByText('لا تملك صلاحية عرض التقارير')
    expect(msgs.length).toBeGreaterThanOrEqual(1)
    expect(reportsApi.dashboard).not.toHaveBeenCalled()
  })

  it('hides create actions without permissions', async () => {
    renderDash(['reports.view'])
    expect(await screen.findByRole('link', { name: 'التقارير' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'حجز جديد' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'تأجير جديد' })).not.toBeInTheDocument()
  })

  it('shows loading then KPIs', async () => {
    let resolveDash: (v: typeof dashboardData) => void = () => undefined
    vi.mocked(reportsApi.dashboard).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDash = resolve
        })
    )
    renderDash(['reports.view'])
    expect((await screen.findAllByText('جاري التحميل…')).length).toBeGreaterThanOrEqual(1)
    resolveDash(dashboardData)
    expect(await screen.findByText('تأجيرات نشطة')).toBeInTheDocument()
  })

  it('shows error state when dashboard fails', async () => {
    vi.mocked(reportsApi.dashboard).mockRejectedValue(new Error('offline'))
    renderDash(['reports.view'])
    expect(await screen.findByText('تعذر تحميل المؤشرات')).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1)
  })

  it('exposes main landmark and section headings for a11y', async () => {
    renderDash(['reports.view', 'audit.view', 'system.view'])
    const main = await screen.findByRole('main')
    expect(main).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'المؤشرات' })).toBeInTheDocument()
    })
  })
})
