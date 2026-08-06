import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config returns/processing (V2)', () => {
  it('hides returns and processing (V2_UNSUPPORTED modules)', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    expect(main!.items.find((i) => i.id === 'returns')).toBeUndefined()
    expect(main!.items.find((i) => i.id === 'processing')).toBeUndefined()
  })
})
