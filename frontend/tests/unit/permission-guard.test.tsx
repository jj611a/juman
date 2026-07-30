import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PermissionGuard } from '@/components/ui'
import { PermissionGate } from '@/app/PermissionGate'
import { useAuthStore } from '@/stores/authStore'

function seed(perms: string[]): void {
  useAuthStore.getState().setSession({
    authenticated: true,
    permissions: perms,
    user: {
      id: '1',
      username: 'u',
      full_name: 'U',
      role_id: 'r',
      is_active: true
    }
  })
}

describe('PermissionGuard', () => {
  beforeEach(() => {
    seed(['a', 'b'])
  })

  it('hides when permission missing', () => {
    render(
      <PermissionGuard permission="z" mode="hide">
        <span>secret</span>
      </PermissionGuard>
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('disables when permission missing', () => {
    render(
      <PermissionGuard permission="z" mode="disable">
        <button type="button">edit</button>
      </PermissionGuard>
    )
    expect(screen.getByText('edit').closest('[aria-disabled="true"]')).toBeTruthy()
  })

  it('supports anyOf and allOf', () => {
    const { rerender } = render(
      <PermissionGuard anyOf={['z', 'a']}>
        <span>any</span>
      </PermissionGuard>
    )
    expect(screen.getByText('any')).toBeInTheDocument()

    rerender(
      <PermissionGuard allOf={['a', 'b']}>
        <span>all</span>
      </PermissionGuard>
    )
    expect(screen.getByText('all')).toBeInTheDocument()

    rerender(
      <PermissionGuard allOf={['a', 'missing']}>
        <span>nope</span>
      </PermissionGuard>
    )
    expect(screen.queryByText('nope')).not.toBeInTheDocument()
  })

  it('PermissionGate still hides without permission', () => {
    render(
      <PermissionGate permission="missing">
        <span>gated</span>
      </PermissionGate>
    )
    expect(screen.queryByText('gated')).not.toBeInTheDocument()
  })
})
