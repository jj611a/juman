import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'
import { isAppError } from '@shared/errors'
import { guardOnline, toastAppError } from '@/lib/errors/appError'
import type {
  MaintenanceExecuteBody,
  MaintenanceHistoryParams,
  RestoreExecuteBody,
  RestoreHistoryParams,
  RestoreValidateBody,
  SystemBackupCreateBody,
  SystemBackupListParams
} from '@/services/domainTypes'
import { saveBinaryDownload, systemApi, systemKeys } from './api'

export function useSystemHealth(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: () => systemApi.health(),
    enabled: options?.enabled ?? true
  })
}

export function useSystemVersion(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.version(),
    queryFn: () => systemApi.version(),
    enabled: options?.enabled ?? true
  })
}

export function useSystemInfo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.info(),
    queryFn: () => systemApi.info(),
    enabled: options?.enabled ?? true
  })
}

export function useSystemDiagnostics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.diagnostics(),
    queryFn: () => systemApi.diagnostics(),
    enabled: options?.enabled ?? true
  })
}

export function useSystemMetrics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.metrics(),
    queryFn: () => systemApi.metrics(),
    enabled: options?.enabled ?? true
  })
}

export function useMaintenanceTasks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.maintenanceTasks(),
    queryFn: () => systemApi.maintenanceTasks(),
    enabled: options?.enabled ?? true
  })
}

export function useMaintenanceHistory(
  params: MaintenanceHistoryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: systemKeys.maintenanceHistory(params),
    queryFn: () => systemApi.maintenanceHistory(params),
    enabled: options?.enabled ?? true
  })
}

export function useMaintenanceRun(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.maintenanceRun(id ?? ''),
    queryFn: () => systemApi.maintenanceRun(id!),
    enabled: Boolean(id) && (options?.enabled ?? true)
  })
}

export function useBackupsList(params: SystemBackupListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.backupList(params),
    queryFn: () => systemApi.listBackups(params),
    enabled: options?.enabled ?? true
  })
}

export function useBackup(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.backup(id ?? ''),
    queryFn: () => systemApi.getBackup(id!),
    enabled: Boolean(id) && (options?.enabled ?? true)
  })
}

export function useRestoreHistory(params: RestoreHistoryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.restoreHistory(params),
    queryFn: () => systemApi.restoreHistory(params),
    enabled: options?.enabled ?? true
  })
}

export function useRestoreDetail(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemKeys.restore(id ?? ''),
    queryFn: () => systemApi.getRestore(id!),
    enabled: Boolean(id) && (options?.enabled ?? true)
  })
}

function invalidateBackups(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: systemKeys.backups() })
}

function invalidateRestore(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: [...systemKeys.all, 'restore'] })
}

function invalidateMaintenance(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: [...systemKeys.all, 'maintenance'] })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: SystemBackupCreateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.createBackup(body)
    },
    onSuccess: () => {
      toast.success('تم إنشاء النسخة الاحتياطية')
      invalidateBackups(qc)
    },
    onError: (e) => {
      if (isAppError(e) && e.code === 'conflict') {
        toast.error(e.message || 'عملية نسخ احتياطي أخرى قيد التنفيذ')
        return
      }
      toastAppError(e, 'فشل إنشاء النسخة الاحتياطية')
    }
  })
}

export function useDeleteBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.deleteBackup(id)
    },
    onSuccess: () => {
      toast.success('تم حذف النسخة')
      invalidateBackups(qc)
    },
    onError: (e) => toastAppError(e, 'فشل حذف النسخة')
  })
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: async (id: string) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.downloadBackup(id)
    },
    onSuccess: (result) => {
      try {
        saveBinaryDownload(result)
        toast.success('بدأ تنزيل النسخة')
      } catch {
        toast.error('تعذّر حفظ الملف')
      }
    },
    onError: (e) => toastAppError(e, 'فشل تنزيل النسخة')
  })
}

export function useValidateRestore() {
  return useMutation({
    mutationFn: (body: RestoreValidateBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.validateRestore(body)
    },
    onError: (e) => toastAppError(e, 'فشل التحقق من الحزمة')
  })
}

export function useExecuteRestore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RestoreExecuteBody) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.restore(body)
    },
    onSuccess: () => {
      toast.success('اكتملت عملية الاستعادة')
      invalidateRestore(qc)
      invalidateBackups(qc)
    },
    onError: (e) => {
      if (isAppError(e) && e.code === 'conflict') {
        toast.error(e.message || 'استعادة أو نسخ احتياطي قيد التنفيذ')
        return
      }
      toastAppError(e, 'فشلت عملية الاستعادة')
    }
  })
}

export function useExecuteMaintenance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskKey, body }: { taskKey: string; body?: MaintenanceExecuteBody }) => {
      if (!guardOnline()) return Promise.reject({ code: 'OFFLINE', message: 'غير متصل' })
      return systemApi.executeMaintenance(taskKey, body)
    },
    onSuccess: () => {
      toast.success('اكتملت مهمة الصيانة')
      invalidateMaintenance(qc)
    },
    onError: (e) => {
      if (isAppError(e) && e.code === 'conflict') {
        toast.error(e.message || 'عملية صيانة أو نسخ أو استعادة قيد التنفيذ')
        return
      }
      toastAppError(e, 'فشل تنفيذ مهمة الصيانة')
    }
  })
}

export function isConflictError(error: unknown): boolean {
  return isAppError(error) && error.code === 'conflict'
}
