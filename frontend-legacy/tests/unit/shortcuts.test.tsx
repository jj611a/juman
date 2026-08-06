import { describe, expect, it, vi } from 'vitest'
import { shortcutRegistry } from '@/app/shortcuts'

describe('shortcutRegistry', () => {
  it('invokes handler for Control+b', () => {
    const handler = vi.fn()
    const unregister = shortcutRegistry.register({
      id: 'test.sidebar',
      combo: 'Control+b',
      handler
    })
    const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true })
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
    shortcutRegistry.handle(event)
    expect(handler).toHaveBeenCalledTimes(1)
    unregister()
  })
})
