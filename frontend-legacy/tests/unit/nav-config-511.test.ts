import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config admin section (V2)', () => {
  it('keeps hardware; hides users/roles/system/settings/audit', () => {
    const admin = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'admin')
    expect(admin).toBeTruthy()
    expect(admin!.items.find((i) => i.id === 'users')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'roles')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'system')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'settings')).toBeUndefined()
    expect(admin!.items.find((i) => i.id === 'audit')).toBeUndefined()
    const hardware = admin!.items.find((i) => i.id === 'hardware')
    expect(hardware?.permission).toBe('settings.view')
    expect(hardware?.href).toBe('/hardware')
  })
})

describe('nav-config product modules (V2)', () => {
  it('hides brands/colors/sizes; keeps finance/barcodes/categories', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    expect(main!.items.find((i) => i.id === 'brands')).toBeUndefined()
    expect(main!.items.find((i) => i.id === 'colors')).toBeUndefined()
    expect(main!.items.find((i) => i.id === 'sizes')).toBeUndefined()
    expect(main!.items.find((i) => i.id === 'categories')).toMatchObject({
      href: '/categories',
      permission: 'categories.view'
    })
    expect(main!.items.find((i) => i.id === 'finance')).toMatchObject({
      href: '/finance',
      permission: 'finance.view'
    })
    expect(main!.items.find((i) => i.id === 'barcodes')).toMatchObject({
      href: '/barcodes',
      permission: 'barcode.view'
    })
  })
})
