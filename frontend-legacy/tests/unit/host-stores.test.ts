import { describe, expect, it, vi } from 'vitest'
import { dialogHost } from '@/app/hosts/dialog-store'
import { drawerHost } from '@/app/hosts/drawer-store'

describe('dialogHost / drawerHost close idempotency', () => {
  it('dialogHost.close does not emit when already closed', () => {
    dialogHost.close()
    const listener = vi.fn()
    const unsub = dialogHost.subscribe(listener)
    dialogHost.close()
    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  it('drawerHost.close does not emit when already closed', () => {
    drawerHost.close()
    const listener = vi.fn()
    const unsub = drawerHost.subscribe(listener)
    drawerHost.close()
    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  it('dialogHost.close emits once when open', () => {
    const listener = vi.fn()
    const unsub = dialogHost.subscribe(listener)
    dialogHost.open({ title: 't', content: null })
    expect(listener).toHaveBeenCalledTimes(1)
    dialogHost.close()
    expect(listener).toHaveBeenCalledTimes(2)
    dialogHost.close()
    expect(listener).toHaveBeenCalledTimes(2)
    unsub()
  })
})
