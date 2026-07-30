import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config sales/settlements/reports', () => {
  it('enables sales, settlements, reports with correct keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const sales = main!.items.find((i) => i.id === 'sales')
    const settlements = main!.items.find((i) => i.id === 'settlements')
    const reports = main!.items.find((i) => i.id === 'reports')
    expect(sales?.href).toBe('/sales')
    expect(sales?.permission).toBe('sale.view')
    expect(settlements?.href).toBe('/settlements')
    expect(settlements?.permission).toBe('rental.settlement.view')
    expect(reports?.href).toBe('/reports')
    expect(reports?.anyOf).toEqual(['reports.view', 'reports.financial.view'])
  })
})
