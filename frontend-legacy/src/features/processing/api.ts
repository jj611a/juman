import { apiClient } from '@/services/apiClient'
import type {
  InspectionCreateBody,
  InspectionListParams,
  InspectionUpdateBody,
  ProcessingCreateBody,
  ProcessingListParams,
  ProcessingStartBody,
  ProcessingUpdateBody
} from '@/services/domainTypes'

export const inspectionKeys = {
  all: ['inspections'] as const,
  lists: () => [...inspectionKeys.all, 'list'] as const,
  list: (params: InspectionListParams) => [...inspectionKeys.lists(), params] as const,
  details: () => [...inspectionKeys.all, 'detail'] as const,
  detail: (id: string) => [...inspectionKeys.details(), id] as const,
  audit: (id: string) => [...inspectionKeys.detail(id), 'audit'] as const
}

export const processingKeys = {
  all: ['processing'] as const,
  lists: () => [...processingKeys.all, 'list'] as const,
  list: (params: ProcessingListParams) => [...processingKeys.lists(), params] as const,
  details: () => [...processingKeys.all, 'detail'] as const,
  detail: (id: string) => [...processingKeys.details(), id] as const,
  audit: (id: string) => [...processingKeys.detail(id), 'audit'] as const
}

export const inspectionsApi = {
  list: (params?: InspectionListParams) => apiClient.inspections.list(params),
  get: (id: string) => apiClient.inspections.get(id),
  create: (body: InspectionCreateBody) => apiClient.inspections.create(body),
  update: (id: string, body: InspectionUpdateBody) => apiClient.inspections.update(id, body),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'Inspection', entity_id: id, limit: 50 })
}

export const processingApi = {
  list: (params?: ProcessingListParams) => apiClient.processing.list(params),
  get: (id: string) => apiClient.processing.get(id),
  create: (body: ProcessingCreateBody) => apiClient.processing.create(body),
  update: (id: string, body: ProcessingUpdateBody) => apiClient.processing.update(id, body),
  start: (id: string, body?: ProcessingStartBody) => apiClient.processing.start(id, body),
  addOptionalDay: (id: string) => apiClient.processing.addOptionalDay(id),
  complete: (id: string) => apiClient.processing.complete(id),
  audit: (id: string) =>
    apiClient.audit.listLogs({ entity_type: 'ProcessingBatch', entity_id: id, limit: 50 })
}
