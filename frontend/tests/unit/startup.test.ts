import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { StartupManager } from '../../electron/main/startup/StartupManager'
import { STARTUP_DATABASE_LABEL } from '../../electron/shared/startup'

function makeManager(options: {
  probe?: ReturnType<typeof vi.fn>
  timeoutMs?: number
  pollIntervalMs?: number
  onReady?: () => Promise<void> | void
  onStateChange?: (status: unknown) => void
}) {
  const probe =
    options.probe ??
    vi.fn(async () => 'ok' as const)
  const manager = new StartupManager({
    probe,
    timeoutMs: options.timeoutMs ?? 1_000,
    pollIntervalMs: options.pollIntervalMs ?? 100,
    onReady: options.onReady,
    onStateChange: options.onStateChange,
  })
  return { manager, probe }
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
  await Promise.resolve()
  await Promise.resolve()
}

describe('StartupManager state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves booting → starting_backend → waiting_for_health → ready', async () => {
    const states: string[] = []
    const probe = vi.fn()
      .mockResolvedValueOnce('not_ready')
      .mockResolvedValue('ok')
    const { manager } = makeManager({
      probe,
      onStateChange: (s) => states.push((s as { state: string }).state),
    })

    manager.start()
    await flush()

    expect(states).toEqual(['booting', 'starting_backend', 'waiting_for_health'])
    expect(manager.getStatus().healthy).toBe(false)

    await vi.advanceTimersByTimeAsync(100)
    expect(manager.getStatus().state).toBe('ready')
    expect(manager.getStatus().healthy).toBe(true)
    expect(manager.getStatus().message).toBe('النظام جاهز')
  })

  it('reaches READY immediately when the backend is already up', async () => {
    const { manager } = makeManager({})
    manager.start()
    await flush()
    expect(manager.getStatus().state).toBe('ready')
  })

  it('keeps waiting while degraded and surfaces the database-check message', async () => {
    const probe = vi
      .fn()
      .mockResolvedValueOnce('degraded')
      .mockResolvedValueOnce('degraded')
      .mockResolvedValueOnce('ok')
    const { manager } = makeManager({ probe })

    manager.start()
    await flush()
    expect(manager.getStatus().state).toBe('waiting_for_health')
    expect(manager.getStatus().message).toBe(STARTUP_DATABASE_LABEL)

    await vi.advanceTimersByTimeAsync(100)
    expect(manager.getStatus().state).toBe('waiting_for_health')

    await vi.advanceTimersByTimeAsync(100)
    expect(manager.getStatus().state).toBe('ready')
  })

  it('reports failed with a stable code when a foreign service answers', async () => {
    const probe = vi.fn(async () => 'foreign' as const)
    const { manager } = makeManager({ probe })

    manager.start()
    await flush()

    expect(manager.getStatus().state).toBe('failed')
    expect(manager.getStatus().errorCode).toBe('BACKEND_FOREIGN_SERVICE')
    expect(manager.getStatus().healthy).toBe(false)
  })

  it('reaches timeout once the deadline passes', async () => {
    const probe = vi.fn(async () => 'not_ready' as const)
    const { manager } = makeManager({ probe, timeoutMs: 1_000, pollIntervalMs: 100 })

    manager.start()
    await flush()
    expect(manager.getStatus().state).toBe('waiting_for_health')

    await vi.advanceTimersByTimeAsync(1_050)
    expect(manager.getStatus().state).toBe('timeout')
  })

  it('retry performs a fresh attempt with incremented counter', async () => {
    let backendUp = false
    const probe = vi.fn(async () => (backendUp ? ('ok' as const) : ('not_ready' as const)))
    const { manager } = makeManager({ probe })

    manager.start()
    await flush()
    await vi.advanceTimersByTimeAsync(1_050)
    expect(manager.getStatus().state).toBe('timeout')
    expect(manager.getStatus().attempt).toBe(1)

    backendUp = true
    manager.retry()
    await flush()
    expect(manager.getStatus().attempt).toBe(2)

    await vi.advanceTimersByTimeAsync(100)
    expect(manager.getStatus().state).toBe('ready')
  })

  it('runs the onReady hook before emitting READY (deferred session restore)', async () => {
    const order: string[] = []
    const onReady = vi.fn(async () => {
      order.push('onReady')
    })

    const { manager } = makeManager({
      onReady,
      onStateChange: (s) => order.push((s as { state: string }).state),
    })
    manager.start()
    await flush()

    expect(order).toEqual([
      'booting',
      'starting_backend',
      'waiting_for_health',
      'onReady',
      'ready',
    ])
    expect(onReady).toHaveBeenCalledOnce()
  })

  it('dispose stops further polling', async () => {
    const probe = vi.fn(async () => 'not_ready' as const)
    const { manager } = makeManager({ probe })

    manager.start()
    await flush()
    manager.dispose()

    const calls = probe.mock.calls.length
    await vi.advanceTimersByTimeAsync(5_000)
    expect(probe.mock.calls.length).toBe(calls)
    expect(manager.getStatus().state).toBe('waiting_for_health')
  })
})
