import { useQuery } from '@tanstack/react-query'
import { auditApi, auditKeys, type AuditListQueryParams } from './api'

export function useAuditLogsList(
  params: AuditListQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => auditApi.listLogs(params),
    enabled: options?.enabled ?? true
  })
}

export function useAuditLog(id: string | undefined) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? ''),
    queryFn: () => auditApi.getLog(id!),
    enabled: Boolean(id)
  })
}
