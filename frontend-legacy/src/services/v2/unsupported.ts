import type { AppError } from '@shared/errors'
import { isAppError } from '@shared/errors'

/** Throw when a legacy UI path has no Nest V2 HTTP equivalent. */
export function v2Unsupported(feature: string): never {
  const err: AppError = {
    code: 'V2_UNSUPPORTED',
    message: `Backend V2 does not support: ${feature}`
  }
  throw err
}

export function isV2Unsupported(error: unknown): boolean {
  return isAppError(error) && error.code === 'V2_UNSUPPORTED'
}
