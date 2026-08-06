import { describe, expect, it } from 'vitest'
import { normalizeDigits, sanitizeNumericInput } from '@/utils/normalizeDigits'

describe('normalizeDigits', () => {
  it('maps Arabic-Indic digits to Western', () => {
    expect(normalizeDigits('١٢٣')).toBe('123')
  })

  it('maps Eastern Arabic-Indic digits', () => {
    expect(normalizeDigits('۴۵۶')).toBe('456')
  })

  it('normalizes comma and Arabic decimal separator', () => {
    expect(normalizeDigits('12,5')).toBe('12.5')
    expect(normalizeDigits('12٫5')).toBe('12.5')
  })
})

describe('sanitizeNumericInput', () => {
  it('keeps a single decimal and optional leading minus', () => {
    expect(sanitizeNumericInput('١٢٣٫٤٥')).toBe('123.45')
    expect(sanitizeNumericInput('-١٠')).toBe('-10')
    expect(sanitizeNumericInput('1.2.3')).toBe('1.23')
  })
})
