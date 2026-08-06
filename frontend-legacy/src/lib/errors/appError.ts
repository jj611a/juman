import { isAppError, type AppError } from '@shared/errors'
import { toast } from '@/components/ui/toast'

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof Error) return { code: 'INTERNAL', message: error.message }
  return { code: 'INTERNAL', message: 'حدث خطأ غير متوقع' }
}

export function toastAppError(error: unknown, fallback = 'فشلت العملية'): void {
  const appError = toAppError(error)
  toast.error(appError.message || fallback)
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export function guardOnline(): boolean {
  if (!isOffline()) return true
  toast.warning('لا يوجد اتصال — تحقق من الشبكة ثم أعد المحاولة')
  return false
}
