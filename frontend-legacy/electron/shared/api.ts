import type { AppError } from './errors'
import type { SessionView } from './session'

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export interface HealthData {
  status: string
  app?: string
  environment?: string
  database?: string
  redis?: string
  version?: string
}

export interface VersionData {
  name: string
  name_ar?: string
  version: string
  api?: string
  environment?: string
}

export interface AppRuntimeConfig {
  locale: 'ar'
  direction: 'rtl'
  appName: string
  appNameAr: string
}
