import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config inventory (V2)', () => {
  it('enables inventory and hides calendar (no Availability HTTP)', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const inventory = main!.items.find((i) => i.id === 'inventory')
    const calendar = main!.items.find((i) => i.id === 'calendar')
    expect(inventory?.href).toBe('/inventory')
    expect(inventory?.permission).toBe('inventory.view')
    expect(inventory?.disabled).toBeFalsy()
    expect(calendar).toBeUndefined()
    const soon = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'soon')
    expect(soon).toBeUndefined()
  })
})
