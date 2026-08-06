import type { StatusMap } from '@/components/ui'

export const HEALTH_STATUS_MAP: StatusMap = {
  ok: { tone: 'success', label: 'سليم' },
  degraded: { tone: 'warning', label: 'متدهور' },
  down: { tone: 'danger', label: 'متوقف' }
}

export const SERVICE_STATUS_MAP: StatusMap = {
  up: { tone: 'success', label: 'يعمل' },
  down: { tone: 'danger', label: 'متوقف' },
  disabled: { tone: 'neutral', label: 'معطّل' }
}

export const DIAGNOSTICS_OVERALL_MAP: StatusMap = {
  ok: { tone: 'success', label: 'جاهز للإنتاج' },
  degraded: { tone: 'warning', label: 'متدهور' },
  down: { tone: 'danger', label: 'غير جاهز' }
}

export const CHECK_STATUS_MAP: StatusMap = {
  pass: { tone: 'success', label: 'ناجح' },
  warn: { tone: 'warning', label: 'تحذير' },
  fail: { tone: 'danger', label: 'فشل' },
  skip: { tone: 'neutral', label: 'تخطّي' }
}

export const BACKUP_STATUS_MAP: StatusMap = {
  PENDING: { tone: 'warning', label: 'قيد الانتظار' },
  RUNNING: { tone: 'info', label: 'قيد التنفيذ' },
  COMPLETED: { tone: 'success', label: 'مكتمل' },
  FAILED: { tone: 'danger', label: 'فشل' }
}

export const RESTORE_STATUS_MAP: StatusMap = {
  PENDING_VALIDATION: { tone: 'warning', label: 'بانتظار التحقق' },
  RUNNING: { tone: 'info', label: 'قيد التنفيذ' },
  COMPLETED: { tone: 'success', label: 'مكتمل' },
  FAILED: { tone: 'danger', label: 'فشل' }
}

export const MAINTENANCE_RUN_STATUS_MAP: StatusMap = {
  PENDING: { tone: 'warning', label: 'قيد الانتظار' },
  RUNNING: { tone: 'info', label: 'قيد التنفيذ' },
  COMPLETED: { tone: 'success', label: 'مكتمل' },
  FAILED: { tone: 'danger', label: 'فشل' },
  SKIPPED: { tone: 'neutral', label: 'تخطّي' }
}
