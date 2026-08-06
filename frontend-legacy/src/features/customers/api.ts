import { apiClient } from '@/services/apiClient'
import type {
  CustomerCreateBody,
  CustomerListParams,
  CustomerUpdateBody,
  FileReferenceCreateBody
} from '@/services/domainTypes'

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  media: (id: string) => [...customerKeys.detail(id), 'media'] as const,
  audit: (id: string) => [...customerKeys.detail(id), 'audit'] as const
}

export const customersApi = {
  list: (params?: CustomerListParams) => apiClient.customers.list(params),
  get: (id: string) => apiClient.customers.get(id),
  create: (body: CustomerCreateBody) => apiClient.customers.create(body),
  update: (id: string, body: CustomerUpdateBody) => apiClient.customers.update(id, body),
  remove: (id: string) => apiClient.customers.remove(id),
  activate: (id: string) => apiClient.customers.activate(id),
  deactivate: (id: string) => apiClient.customers.deactivate(id)
}

/** Thin MediaClient for customer profile / gallery FileReferences. */
export const customerMediaApi = {
  listReferences: (customerId: string) =>
    apiClient.media.listReferences({
      module_name: 'customers',
      entity_type: 'customer',
      entity_id: customerId,
      limit: 100
    }),
  upload: (file: File) => apiClient.media.upload(file),
  createReference: (body: FileReferenceCreateBody) => apiClient.media.createReference(body),
  downloadDataUrl: (fileId: string) => apiClient.media.downloadDataUrl(fileId),
  deleteReference: (referenceId: string) => apiClient.media.deleteReference(referenceId)
}

export const customerAuditApi = {
  list: (customerId: string) =>
    apiClient.audit.listLogs({
      entity_type: 'Customer',
      entity_id: customerId,
      limit: 50
    })
}
