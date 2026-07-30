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
}

export function mapAxiosError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
    const ax = error as AxiosError<BackendErrorBody>
    const data = ax.response?.data
    if (data?.error?.code && data.error.message) {
      return {
        code: data.error.code,
        message: data.error.message,
        details: data.error.details
      }
    }
    if (typeof data?.detail === 'string') {
      return { code: 'HTTP_ERROR', message: data.detail }
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
