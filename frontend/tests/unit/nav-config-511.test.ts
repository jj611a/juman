import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config admin section', () => {
  it('enables users roles settings audit system', () => {
    const admin = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'admin')
    expect(admin).toBeTruthy()
    const users = admin!.items.find((i) => i.id === 'users')
    const roles = admin!.items.find((i) => i.id === 'roles')
    const settings = admin!.items.find((i) => i.id === 'settings')
    const audit = admin!.items.find((i) => i.id === 'audit')
    const system = admin!.items.find((i) => i.id === 'system')
    expect(users?.href).toBe('/users')
    expect(users?.anyOf).toEqual(['users.view', 'users.manage'])
    expect(roles?.href).toBe('/roles')
    expect(settings?.permission).toBe('settings.view')
    expect(audit?.permission).toBe('audit.view')
    expect(system?.anyOf).toEqual([
      'system.view',
      'system.backup',
      'system.restore',
      'system.maintenance'
    ])
  })
})
