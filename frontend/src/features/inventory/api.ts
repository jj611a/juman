import { apiClient } from '@/services/apiClient'
import type {
  DressCreateBody,
  DressListParams,
  DressStatusChangeBody,
  DressUpdateBody
} from '@/services/domainTypes'

export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (params: DressListParams) => [...inventoryKeys.lists(), params] as const,
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
  photos: (id: string) => [...inventoryKeys.detail(id), 'photos'] as const,
  audit: (id: string) => [...inventoryKeys.detail(id), 'audit'] as const
}

export const inventoryApi = {
  list: (params?: DressListParams) => apiClient.dresses.list(params),
  get: (id: string) => apiClient.dresses.get(id),
  getByBarcode: (barcode: string) => apiClient.dresses.getByBarcode(barcode),
  create: (body: DressCreateBody) => apiClient.dresses.create(body),
  update: (id: string, body: DressUpdateBody) => apiClient.dresses.update(id, body),
  remove: (id: string) => apiClient.dresses.remove(id),
  activate: (id: string) => apiClient.dresses.activate(id),
  deactivate: (id: string) => apiClient.dresses.deactivate(id),
  changeStatus: (id: string, body: DressStatusChangeBody) =>
    apiClient.dresses.changeStatus(id, body),
  updateBarcode: (id: string, barcode?: string | null) =>
    apiClient.dresses.updateBarcode(id, { barcode }),
  listPhotos: (dressId: string) => apiClient.dressPhotos.list(dressId),
  addPhoto: (dressId: string, storedFileId: string, isCover?: boolean) =>
    apiClient.dressPhotos.create(dressId, { stored_file_id: storedFileId, is_cover: isCover }),
  setCover: (dressId: string, photoId: string) => apiClient.dressPhotos.setCover(dressId, photoId),
  removePhoto: (photoId: string) => apiClient.dressPhotos.remove(photoId),
  audit: (dressId: string) =>
    apiClient.audit.listLogs({ entity_type: 'Dress', entity_id: dressId, limit: 50 })
}
