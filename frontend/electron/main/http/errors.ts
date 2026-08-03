import type { AxiosError } from 'axios'
import type { AppError } from '../../shared/errors'

interface BackendErrorBody {
  success?: boolean
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  detail?: string | { message?: string }
  /** NestJS GlobalHttpExceptionFilter shape */
  statusCode?: number
  message?: string | string[]
}

export function messageFromNestBody(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const body = data as BackendErrorBody
  if (typeof body.message === 'string' && body.message.trim()) return body.message
  if (Array.isArray(body.message) && body.message.length > 0) {
    return body.message.map(String).join(', ')
  }
  if (body.error?.message) return body.error.message
  if (typeof body.detail === 'string') return body.detail
  return undefined
}

export function mapAxiosError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    const ax = error as AxiosError<BackendErrorBody>
    const data = ax.response?.data
    const nestMessage = messageFromNestBody(data)
    if (data?.error?.code && data.error.message) {
      return {
        code: data.error.code,
        message: data.error.message,
        details: data.error.details
      }
    }
    if (nestMessage) {
      return {
        code: ax.response?.status === 401 ? 'INVALID_CREDENTIALS' : 'HTTP_ERROR',
        message: nestMessage
      }
    }
    if (ax.code === 'ECONNREFUSED' || ax.code === 'ENOTFOUND') {
      return {
        code: 'BACKEND_UNAVAILABLE',
        message: 'تعذر الاتصال بالخادم'
      }
    }
    return {
      code: 'HTTP_ERROR',
      message: ax.message || 'حدث خطأ في الاتصال'
    }
  }
  if (error instanceof Error) {
    return { code: 'INTERNAL', message: error.message }
  }
  return { code: 'INTERNAL', message: 'خطأ غير معروف' }
}
