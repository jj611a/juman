import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config returns/processing', () => {
  it('enables returns and processing with correct permission keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const returns = main!.items.find((i) => i.id === 'returns')
    const processing = main!.items.find((i) => i.id === 'processing')
    expect(returns?.href).toBe('/returns')
    expect(returns?.permission).toBe('return.view')
    expect(returns?.disabled).toBeFalsy()
    expect(processing?.href).toBe('/processing')
    expect(processing?.anyOf).toEqual(['processing.view', 'inspection.view'])
    expect(processing?.disabled).toBeFalsy()
  })
})
