export interface AppError {
  code: string
  message: string
  details?: unknown
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export interface AppRuntimeConfig {
  apiBaseUrl: string
}
