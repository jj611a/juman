import { apiClient } from '@/services/apiClient'
import type { ApiBinaryResult } from '@shared/apiInvoke'
import type {
  HealthDto,
  ItemEnvelope,
  ItemsEnvelope,
  ListEnvelope,
  MaintenanceExecuteBody,
  MaintenanceHistoryParams,
  MaintenanceRunDto,
  MaintenanceTaskDto,
  PaginationMeta,
  RestoreExecuteBody,
  RestoreHistoryDto,
  RestoreHistoryParams,
  RestoreValidateBody,
  SystemBackupCreateBody,
  SystemBackupDto,
  SystemBackupListParams,
  SystemDiagnosticsDto,
  SystemInfoDto,
  SystemMetricsDto,
  VersionDto
} from '@/services/domainTypes'

function normalizeListEnvelope<T>(
  raw: ListEnvelope<T> | { items?: T[]; data?: T[]; meta?: PaginationMeta; total?: number },
  params?: { offset?: number; limit?: number }
): ListEnvelope<T> {
  if ('data' in raw && Array.isArray(raw.data) && raw.meta) {
    return raw as ListEnvelope<T>
  }
  const items =
    ('items' in raw && Array.isArray(raw.items) ? raw.items : undefined) ??
    ('data' in raw && Array.isArray(raw.data) ? raw.data : [])
  const meta = raw.meta
  return {
    success: true,
    data: items,
    meta: {
      offset: params?.offset ?? meta?.offset ?? 0,
      limit: params?.limit ?? meta?.limit ?? items.length,
      total: meta?.total ?? ('total' in raw ? Number(raw.total) : undefined) ?? items.length
    }
  }
}

function normalizeItemEnvelope<T>(raw: ItemEnvelope<T> | T): ItemEnvelope<T> {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    'success' in raw &&
    typeof (raw as ItemEnvelope<T>).success === 'boolean'
  ) {
    return raw as ItemEnvelope<T>
  }
  return { success: true, data: raw as T }
}

function normalizeItemsList<T>(
  raw: ItemsEnvelope<T> | { items: T[] } | MaintenanceTaskDto[] | T[]
): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if ('items' in raw && Array.isArray(raw.items)) return raw.items as T[]
  return []
}

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
  version: () => [...systemKeys.all, 'version'] as const,
  info: () => [...systemKeys.all, 'info'] as const,
  diagnostics: () => [...systemKeys.all, 'diagnostics'] as const,
  metrics: () => [...systemKeys.all, 'metrics'] as const,
  maintenanceTasks: () => [...systemKeys.all, 'maintenance', 'tasks'] as const,
  maintenanceHistory: (params: MaintenanceHistoryParams) =>
    [...systemKeys.all, 'maintenance', 'history', params] as const,
  maintenanceRun: (id: string) => [...systemKeys.all, 'maintenance', 'run', id] as const,
  backups: () => [...systemKeys.all, 'backups'] as const,
  backupList: (params: SystemBackupListParams) => [...systemKeys.backups(), 'list', params] as const,
  backup: (id: string) => [...systemKeys.backups(), 'detail', id] as const,
  restoreHistory: (params: RestoreHistoryParams) =>
    [...systemKeys.all, 'restore', 'history', params] as const,
  restore: (id: string) => [...systemKeys.all, 'restore', 'detail', id] as const
}

export const systemApi = {
  health: (): Promise<HealthDto> => apiClient.system.health(),
  version: (): Promise<VersionDto> => apiClient.system.version(),
  info: (): Promise<SystemInfoDto> => apiClient.system.info(),
  diagnostics: (): Promise<SystemDiagnosticsDto> => apiClient.system.diagnostics(),
  metrics: (): Promise<SystemMetricsDto> => apiClient.system.metrics(),

  maintenanceTasks: async (): Promise<MaintenanceTaskDto[]> => {
    const raw = await apiClient.system.maintenanceTasks()
    return normalizeItemsList<MaintenanceTaskDto>(raw)
  },

  executeMaintenance: async (
    taskKey: string,
    body?: MaintenanceExecuteBody
  ): Promise<ItemEnvelope<MaintenanceRunDto>> => {
    const raw = await apiClient.system.executeMaintenance(taskKey, body)
    return normalizeItemEnvelope(raw)
  },

  maintenanceHistory: async (
    params?: MaintenanceHistoryParams
  ): Promise<ListEnvelope<MaintenanceRunDto>> => {
    const raw = await apiClient.system.maintenanceHistory(params)
    return normalizeListEnvelope(raw, params)
  },

  maintenanceRun: async (id: string): Promise<ItemEnvelope<MaintenanceRunDto>> => {
    const raw = await apiClient.system.maintenanceRun(id)
    return normalizeItemEnvelope(raw)
  },

  listBackups: async (params?: SystemBackupListParams): Promise<ListEnvelope<SystemBackupDto>> => {
    const raw = await apiClient.system.listBackups(params)
    return normalizeListEnvelope(raw, params)
  },

  getBackup: async (id: string): Promise<ItemEnvelope<SystemBackupDto>> => {
    const raw = await apiClient.system.getBackup(id)
    return normalizeItemEnvelope(raw)
  },

  createBackup: async (
    body?: SystemBackupCreateBody
  ): Promise<ItemEnvelope<SystemBackupDto>> => {
    const raw = await apiClient.system.createBackup(body)
    return normalizeItemEnvelope(raw)
  },

  deleteBackup: (id: string) => apiClient.system.deleteBackup(id),

  downloadBackup: (id: string): Promise<ApiBinaryResult> => apiClient.system.downloadBackup(id),

  validateRestore: (body: RestoreValidateBody) => apiClient.system.validateRestore(body),

  restore: async (body: RestoreExecuteBody): Promise<ItemEnvelope<RestoreHistoryDto>> => {
    const raw = await apiClient.system.restore(body)
    return normalizeItemEnvelope(raw)
  },

  restoreHistory: async (
    params?: RestoreHistoryParams
  ): Promise<ListEnvelope<RestoreHistoryDto>> => {
    const raw = await apiClient.system.restoreHistory(params)
    return normalizeListEnvelope(raw, params)
  },

  getRestore: async (id: string): Promise<ItemEnvelope<RestoreHistoryDto>> => {
    const raw = await apiClient.system.getRestore(id)
    return normalizeItemEnvelope(raw)
  }
}

export function saveBinaryDownload(result: ApiBinaryResult): void {
  const anchor = document.createElement('a')
  anchor.href = result.dataUrl
  anchor.download = result.fileName ?? 'backup.juman'
  anchor.click()
}

export function taskKeyOf(task: MaintenanceTaskDto): string {
  return String(task.key ?? task.id ?? '')
}

export function taskTitleOf(task: MaintenanceTaskDto): string {
  return String(task.name ?? task.title ?? task.key ?? task.id ?? '—')
}

export function diagnosticsOverall(diagnostics: SystemDiagnosticsDto): string {
  const d = diagnostics as { overall?: string; status?: string }
  return String(d.overall ?? d.status ?? 'unknown')
}

export function formatBytes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
