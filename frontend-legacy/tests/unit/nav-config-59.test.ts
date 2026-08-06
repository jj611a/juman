import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config settlements/reports (V2)', () => {
  it('hides sales; enables settlements and reports with anyOf keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const sales = main!.items.find((i) => i.id === 'sales')
    const settlements = main!.items.find((i) => i.id === 'settlements')
    const reports = main!.items.find((i) => i.id === 'reports')
    expect(sales).toBeUndefined()
    expect(settlements?.href).toBe('/settlements')
    expect(settlements?.anyOf).toEqual(['rental.settlement.view', 'finance.settlement.view'])
    expect(reports?.href).toBe('/reports')
    expect(reports?.anyOf).toEqual(['reports.view', 'reports.financial.view'])
  })
})
