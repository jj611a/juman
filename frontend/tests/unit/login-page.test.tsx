import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import LoginPage from '@/routes/LoginPage'
import { useAuthStore } from '@/stores/authStore'

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    auth: {
      login: vi.fn()
    },
    app: {
      getConfig: vi.fn().mockResolvedValue({ appName: 'Juman', appNameAr: 'جمان' })
    },
    system: {
      version: vi.fn().mockResolvedValue({ version: '1.0.0' })
    }
  }
}))

import { apiClient } from '@/services/apiClient'

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      authenticated: false,
      permissions: [],
      mustChangePassword: false
    })
    useAuthStore.getState().setReady(true)
    vi.mocked(apiClient.auth.login).mockReset()
  })

  it('validates required fields and disables while submitting', async () => {
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>
    )

    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByText(/يرجى إدخال/)).toBeInTheDocument()
    expect(apiClient.auth.login).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('اسم المستخدم'), 'admin')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret')

    vi.mocked(apiClient.auth.login).mockImplementation(
      () =>
        new Promise(() => {
          /* pending */
        })
    )
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByRole('button', { name: 'جاري تسجيل الدخول…' })).toBeDisabled()
  })

  it('focuses username on mount', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>
    )
    expect(screen.getByLabelText('اسم المستخدم')).toHaveFocus()
  })
})
