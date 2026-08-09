/** Startup state machine contract between Main, Preload, and Renderer. */

export const STARTUP_STATES = [
  'booting',
  'starting_backend',
  'waiting_for_health',
  'ready',
  'failed',
  'timeout',
] as const

export type StartupState = (typeof STARTUP_STATES)[number]

/** Sanitized status surface — never includes backend process objects, env vars, paths, raw errors, or tokens. */
export interface StartupStatus {
  state: StartupState
  message: string
  healthy: boolean
  /** Stable machine-readable code (e.g. BACKEND_FOREIGN_SERVICE) or null. */
  errorCode: string | null
  /** 1-based attempt number (increments on each retry). */
  attempt: number
  /** ISO timestamp when the current attempt started. */
  startedAt: string
  /** Elapsed ms in the current attempt. Display-only; not a progress percentage. */
  elapsedMs: number
}

export const STARTUP_DEFAULT_TIMEOUT_MS = 60_000
export const STARTUP_DEFAULT_POLL_MS = 1_500

export const STARTUP_STATE_LABELS: Record<StartupState, string> = {
  booting: 'جاري تشغيل النظام...',
  starting_backend: 'جاري تشغيل الخادم...',
  waiting_for_health: 'جاري تجهيز النظام...',
  ready: 'النظام جاهز',
  failed: 'تعذر تشغيل الخادم',
  timeout: 'استغرق تشغيل الخادم وقتاً أطول من المتوقع.',
}

/** Shown while the backend answers but the database is not yet connected. */
export const STARTUP_DATABASE_LABEL = 'جاري التحقق من قاعدة البيانات...'
