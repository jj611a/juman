import { describe, expect, it } from 'vitest'
import { displayToFils, filsToDisplay, formatMoney, IQD } from '@/lib/money/currency'

describe('money currency', () => {
  it('converts fils to display and back without floats', () => {
    expect(filsToDisplay(150000, IQD)).toBe('150.000')
    expect(displayToFils('150.000', IQD)).toBe(150000)
    expect(displayToFils('2.500', IQD)).toBe(2500)
    expect(displayToFils('0.250', IQD)).toBe(250)
  })

  it('handles empty and zero', () => {
    expect(displayToFils('', IQD)).toBeNull()
    expect(displayToFils('0', IQD)).toBe(0)
    expect(filsToDisplay(0, IQD)).toBe('0.000')
  })

  it('formats with currency code', () => {
    expect(formatMoney(2500, IQD)).toBe('2.500 IQD')
  })
})
