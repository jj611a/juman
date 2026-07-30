import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PermissionGate } from '@/app/PermissionGate'
import { useAuthStore } from '@/stores/authStore'

describe('PermissionGate', () => {
  it('fails closed when permission missing', () => {
    useAuthStore.setState({
      ready: true,
      session: { authenticated: true, permissions: ['customer.view'], user: undefined }
    })
    render(
      <PermissionGate permission="sale.create" fallback={<span>ممنوع</span>}>
        <span>مسموح</span>
      </PermissionGate>
    )
    expect(screen.getByText('ممنوع')).toBeInTheDocument()
    expect(screen.queryByText('مسموح')).toBeNull()
  })

  it('renders children when permission present', () => {
    useAuthStore.setState({
      ready: true,
      session: { authenticated: true, permissions: ['sale.create'] }
    })
    render(
      <PermissionGate permission="sale.create">
        <span>مسموح</span>
      </PermissionGate>
    )
    expect(screen.getByText('مسموح')).toBeInTheDocument()
  })
})
