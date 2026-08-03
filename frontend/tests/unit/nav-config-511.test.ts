import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config admin section (V2)', () => {
  it('keeps settings/hardware/audit; hides users/roles/system', () => {
    const admin = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'admin')
    expect(admin).toBeTruthy()
    expect(admin!.items.find((i) => i.id === 'users')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'roles')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'system')).toBeUndefined()
    const settings = admin!.items.find((i) => i.id === 'settings')
    const hardware = admin!.items.find((i) => i.id === 'hardware')
    const audit = admin!.items.find((i) => i.id === 'audit')
    expect(settings?.permission).toBe('settings.view')
    expect(hardware?.permission).toBe('settings.view')
    expect(audit?.permission).toBe('audit.view')
  })
})
