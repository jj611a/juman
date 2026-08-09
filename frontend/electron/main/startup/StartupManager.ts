import {
  STARTUP_DATABASE_LABEL,
  STARTUP_DEFAULT_POLL_MS,
  STARTUP_DEFAULT_TIMEOUT_MS,
  STARTUP_STATE_LABELS,
  type StartupState,
  type StartupStatus,
} from '../../shared/startup'

export type HealthProbeResult = 'ok' | 'degraded' | 'not_ready' | 'foreign'
export type HealthProbe = () => Promise<HealthProbeResult>
export type StartupStateListener = (status: StartupStatus) => void

export interface StartupManagerOptions {
  /** Real health probe. Must reflect the actual backend, never fake readiness. */
  probe: HealthProbe
  /** Emitted on every state change (wired to IPC push in Main). */
  onStateChange?: StartupStateListener
  /** Awaited BEFORE 'ready' is emitted (e.g. deferred session.bootstrap()). */
  onReady?: () => Promise<void> | void
  /** Optional backend launcher. NOT used in this packaging — backend runs externally. */
  startBackend?: () => Promise<void>
  timeoutMs?: number
  pollIntervalMs?: number
  /** Injectable clock for deterministic tests. */
  now?: () => number
}

/**
 * Startup state machine (Main-process authority).
 *
 *   booting → starting_backend → waiting_for_health ──▶ ready
 *                                      │                  │
 *                                      ▼                  ▼
 *                               timeout (deadline)   failed (foreign service)
 *
 * Pure TypeScript — no Electron imports — so it is unit-testable in Node.
 * The renderer only ever sees the sanitized StartupStatus surface.
 */
export class StartupManager {
  private status: StartupStatus
  private readonly probe: HealthProbe
  private readonly onStateChange: StartupStateListener | undefined
  private readonly onReadyHook: (() => Promise<void> | void) | undefined
  private readonly startBackend: (() => Promise<void>) | undefined
  private readonly timeoutMs: number
  private readonly pollIntervalMs: number
  private readonly now: () => number

  private stopped = false
  private everEmitted = false
  private attempt = 0
  private attemptStartedAt = 0
  private deadline = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private errorCode: string | null = null

  constructor(options: StartupManagerOptions) {
    this.probe = options.probe
    this.onStateChange = options.onStateChange
    this.onReadyHook = options.onReady
    this.startBackend = options.startBackend
    this.timeoutMs = options.timeoutMs ?? STARTUP_DEFAULT_TIMEOUT_MS
    this.pollIntervalMs = options.pollIntervalMs ?? STARTUP_DEFAULT_POLL_MS
    this.now = options.now ?? (() => Date.now())
    this.status = this.buildStatus('booting')
  }

  getStatus(): StartupStatus {
    return { ...this.status }
  }

  /** Begin (or restart after a retry) the startup sequence. */
  start(): void {
    this.clearTimer()
    this.stopped = false
    this.errorCode = null
    this.attempt += 1
    this.attemptStartedAt = this.now()
    this.deadline = this.attemptStartedAt + this.timeoutMs
    this.emit('booting')
    void this.runAttempt()
  }

  /** Retry performs a genuinely new attempt with a fresh deadline. */
  retry(): void {
    this.start()
  }

  dispose(): void {
    this.stopped = true
    this.clearTimer()
  }

  private async runAttempt(): Promise<void> {
    if (this.stopped) return
    this.emit('starting_backend')
    if (this.startBackend) {
      try {
        await this.startBackend()
      } catch {
        if (this.stopped) return
        this.emit('failed', { errorCode: 'BACKEND_START_FAILED' })
        return
      }
    }
    if (this.stopped) return
    this.emit('waiting_for_health')
    await this.poll()
  }

  private async poll(): Promise<void> {
    if (this.stopped) return
    if (this.now() >= this.deadline) {
      this.emit('timeout')
      return
    }

    const result = await this.probe()
    if (this.stopped) return

    switch (result) {
      case 'ok':
        try {
          await this.onReadyHook?.()
        } catch {
          // Session restore must never block readiness.
        }
        if (this.stopped) return
        this.emit('ready')
        return
      case 'foreign':
        this.emit('failed', { errorCode: 'BACKEND_FOREIGN_SERVICE' })
        return
      case 'degraded':
        this.emit('waiting_for_health', { message: STARTUP_DATABASE_LABEL })
        break
      case 'not_ready':
        this.emit('waiting_for_health')
        break
    }

    this.timer = setTimeout(() => {
      void this.poll()
    }, this.pollIntervalMs)
  }

  private emit(
    state: StartupState,
    opts?: { message?: string; errorCode?: string }
  ): void {
    this.errorCode = opts?.errorCode ?? null
    const message = opts?.message ?? STARTUP_STATE_LABELS[state]
    const changed =
      !this.everEmitted ||
      this.status.state !== state ||
      this.status.message !== message ||
      this.status.errorCode !== this.errorCode
    this.everEmitted = true
    this.status = this.buildStatus(state, message)
    if (changed) {
      this.onStateChange?.(this.getStatus())
    }
  }

  private buildStatus(state: StartupState, messageOverride?: string): StartupStatus {
    return {
      state,
      message: messageOverride ?? STARTUP_STATE_LABELS[state],
      healthy: state === 'ready',
      errorCode: this.errorCode,
      attempt: this.attempt,
      startedAt: this.attemptStartedAt
        ? new Date(this.attemptStartedAt).toISOString()
        : new Date().toISOString(),
      elapsedMs: this.attemptStartedAt
        ? Math.max(0, this.now() - this.attemptStartedAt)
        : 0,
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
