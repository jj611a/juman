import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config inventory/calendar', () => {
  it('enables inventory and calendar with correct permission keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const inventory = main!.items.find((i) => i.id === 'inventory')
    const calendar = main!.items.find((i) => i.id === 'calendar')
    expect(inventory?.href).toBe('/inventory')
    expect(inventory?.permission).toBe('inventory.view')
    expect(inventory?.disabled).toBeFalsy()
    expect(calendar?.href).toBe('/calendar')
    expect(calendar?.permission).toBe('calendar.view')
    expect(calendar?.disabled).toBeFalsy()
    const soon = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'soon')
    expect(soon).toBeUndefined()
  })
})
