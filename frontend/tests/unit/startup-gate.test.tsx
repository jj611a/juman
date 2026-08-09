import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StrictMode } from 'react'
import { StartupGate } from '@/features/startup/components/StartupGate'
import { StartupSplash } from '@/features/startup/components/StartupSplash'
import type { StartupStatus } from '@shared/startup'

// React 19 requires this flag for act() to work in test environments.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

function makeStatus(overrides: Partial<StartupStatus>): StartupStatus {
  return {
    state: 'waiting_for_health',
    message: 'جاري تجهيز النظام...',
    healthy: false,
    errorCode: null,
    attempt: 1,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
    ...overrides,
  }
}

interface MockStartupApi {
  getStatus: ReturnType<typeof vi.fn>
  retry: ReturnType<typeof vi.fn>
  onChanged: ReturnType<typeof vi.fn>
}

function installMockStartup(initial: StartupStatus | null): MockStartupApi {
  const listeners = new Set<(s: StartupStatus) => void>()
  const api: MockStartupApi = {
    getStatus: vi.fn().mockResolvedValue(initial),
    retry: vi.fn().mockResolvedValue(undefined),
    onChanged: vi.fn((listener: (s: StartupStatus) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  }
  ;(globalThis.window as unknown as { juman: unknown }).juman = {
    startup: api,
    app: { quit: vi.fn().mockResolvedValue(undefined) },
  }
  return api
}

async function renderGate(api: MockStartupApi) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root: Root
  await act(async () => {
    root = createRoot(container)
    root.render(
      <StrictMode>
        <StartupGate>
          <div data-testid="app-content">app unlocked</div>
        </StartupGate>
      </StrictMode>,
    )
  })
  // Capture the listener registered by the hook so tests can push status updates.
  return {
    container,
    async cleanup() {
      await act(async () => {
        root!.unmount()
      })
      container.remove()
    },
  }
}

function lastListener(api: MockStartupApi): (s: StartupStatus) => void {
  const calls = api.onChanged.mock.calls
  return calls[calls.length - 1][0] as (s: StartupStatus) => void
}

describe('StartupGate', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the splash until the backend reports READY, then unlocks the app', async () => {
    const api = installMockStartup(makeStatus({ state: 'waiting_for_health' }))

    const gate = await renderGate(api)

    expect(gate.container.querySelector('[data-testid="app-content"]')).toBeNull()
    expect(gate.container.textContent).toContain('جمان')

    await act(async () => {
      lastListener(api)(
        makeStatus({ state: 'ready', message: 'النظام جاهز', healthy: true }),
      )
    })

    expect(gate.container.querySelector('[data-testid="app-content"]')).not.toBeNull()
    await gate.cleanup()
  })

  it('exposes retry and quit actions on failure', async () => {
    const api = installMockStartup(
      makeStatus({
        state: 'failed',
        message: 'تعذر تشغيل الخادم',
        errorCode: 'BACKEND_FOREIGN_SERVICE',
      }),
    )

    const gate = await renderGate(api)

    expect(gate.container.textContent).toContain('إعادة المحاولة')
    expect(gate.container.textContent).toContain('إغلاق التطبيق')
    expect(gate.container.textContent).toContain('BACKEND_FOREIGN_SERVICE')

    await gate.cleanup()
  })

  it('StartupSplash shows the attempt count while waiting', async () => {
    const api = installMockStartup(makeStatus({ state: 'waiting_for_health' }))

    const gate = await renderGate(api)
    expect(gate.container.textContent).toContain('المحاولة 1')
    await gate.cleanup()
  })

  it('StartupSplash renders the ready message with a healthy flag', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <StartupSplash
          status={makeStatus({ state: 'ready', message: 'النظام جاهز', healthy: true })}
        />,
      )
    })
    expect(container.textContent).toContain('النظام جاهز')
    act(() => root.unmount())
    container.remove()
  })
})
