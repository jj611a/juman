import { apiClient } from '@/services/apiClient'
import type {
  AuditLogDto,
  AuditLogListParams,
  ItemEnvelope,
  ListEnvelope
} from '@/services/domainTypes'

export type AuditListQueryParams = AuditLogListParams & {
  created_from?: string
  created_to?: string
}

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (params: AuditListQueryParams) => [...auditKeys.lists(), params] as const,
  details: () => [...auditKeys.all, 'detail'] as const,
  detail: (id: string) => [...auditKeys.details(), id] as const
}

export const auditApi = {
  listLogs: (params?: AuditListQueryParams): Promise<ListEnvelope<AuditLogDto>> =>
    apiClient.audit.listLogs(params),
  getLog: (id: string): Promise<ItemEnvelope<AuditLogDto>> => apiClient.audit.getLog(id)
}
