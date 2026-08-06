export interface AppError {
  code: string
  message: string
  details?: unknown
}

export class AppErrorObject extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(error: AppError) {
    super(error.message)
    this.name = 'AppError'
    this.code = error.code
    this.details = error.details
  }
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).code === 'string' &&
    typeof (value as AppError).message === 'string'
  )
}
