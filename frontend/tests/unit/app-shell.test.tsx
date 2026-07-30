import * as React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppShellFrame, type ShellNavSection } from '@/layouts/shell'
import { useAuthStore } from '@/stores/authStore'

const SECTIONS: ShellNavSection[] = [
  {
    id: 'main',
    label: 'القائمة',
    items: [
      { id: 'visible', label: 'مرئي', href: '/a', icon: 'Home', permission: 'demo.view', badge: 2 },
      { id: 'hidden', label: 'مخفي', href: '/b', icon: 'Lock', permission: 'demo.hidden' }
    ]
  }
]

function renderShell(ui: React.ReactElement): void {
  render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AppShellFrame / Sidebar', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      authenticated: true,
      permissions: ['demo.view'],
      mustChangePassword: false,
      user: {
        id: '1',
        username: 'demo',
        full_name: 'Demo',
        role_id: 'r',
        is_active: true
      }
    })
  })

  it('filters nav by permission, shows icon/badge, toggles collapse, renders status bar', async () => {
    const user = userEvent.setup()
    renderShell(
      <AppShellFrame
        sections={SECTIONS}
        showWindowControls={false}
        resizable={false}
        online
        appVersion="جمان"
        backendVersion="1.0.0"
      >
        <p>workspace</p>
      </AppShellFrame>
    )

    expect(screen.getByText('مرئي')).toBeInTheDocument()
    expect(screen.queryByText('مخفي')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('workspace')).toBeInTheDocument()
    expect(screen.getByLabelText('التنقل الرئيسي')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText(/متصل/)).toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'طي الشريط الجانبي' })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'توسيع الشريط الجانبي' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
})
