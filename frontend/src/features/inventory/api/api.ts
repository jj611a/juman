import { apiInvoke } from '@/ipc/api'

export interface ItemDto {
  id: string
  displayName: string
  internalCode: string
  categoryId?: string | null
  brandId?: string | null
  colorId?: string | null
  sizeId?: string | null
  purchasePrice?: number | null
  rentalPrice?: number | null
  salePrice?: number | null
  status: string
  condition: string
  lifecycleState: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  category?: { id: string; name: string } | null
  brand?: { id: string; name: string } | null
  color?: { id: string; name: string; hexCode?: string } | null
  size?: { id: string; name: string } | null
  barcodes?: Array<{ id: string; value: string; status: string }> | null
  media?: Array<{ id: string; mediaFileId: string; purpose?: string; isPrimary?: boolean; displayOrder?: number }> | null
}

export interface ListItemsQuery {
  q?: string
  barcode?: string
  categoryId?: string
  brandId?: string
  colorId?: string
  sizeId?: string
  status?: string
  lifecycleState?: string
  deleted?: string
  sortBy?: string
  sortDir?: string
  offset?: number
  limit?: number
}

export interface PaginatedItems {
  data: ItemDto[]
  total: number
}

export interface TaxonomyDto {
  id: string
  name: string
  description?: string | null
}

export interface CreateItemPayload {
  displayName: string
  categoryId?: string
  brandId?: string
  colorId?: string
  sizeId?: string
  purchasePrice?: number
  rentalPrice?: number
  salePrice?: number
  status?: string
  condition?: string
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {}

export const inventoryApi = {
  list(query: ListItemsQuery): Promise<PaginatedItems> {
    return apiInvoke({ method: 'GET', path: '/items', query: query as any })
  },

  getById(id: string): Promise<ItemDto> {
    return apiInvoke({ method: 'GET', path: `/items/${id}` })
  },

  create(body: CreateItemPayload): Promise<ItemDto> {
    return apiInvoke({ method: 'POST', path: '/items', body })
  },

  update(id: string, body: UpdateItemPayload): Promise<ItemDto> {
    return apiInvoke({ method: 'PATCH', path: `/items/${id}`, body })
  },

  delete(id: string): Promise<void> {
    return apiInvoke({ method: 'DELETE', path: `/items/${id}` })
  },

  restore(id: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/items/${id}/restore` })
  },

  // Taxonomies API
  getCategories(): Promise<TaxonomyDto[]> {
    return apiInvoke({ method: 'GET', path: '/categories' })
  },

  getBrands(): Promise<TaxonomyDto[]> {
    return apiInvoke({ method: 'GET', path: '/brands' })
  },

  getColors(): Promise<Array<TaxonomyDto & { hexCode?: string }>> {
    return apiInvoke({ method: 'GET', path: '/colors' })
  },

  getSizes(): Promise<TaxonomyDto[]> {
    return apiInvoke({ method: 'GET', path: '/sizes' })
  },

  // Barcode integration
  generateBarcode(type: string): Promise<{ id: string; value: string; status: string }> {
    return apiInvoke({ method: 'POST', path: '/barcodes/generate', body: { type } })
  },

  validateBarcode(value: string, type: string): Promise<any> {
    return apiInvoke({ method: 'POST', path: '/barcodes/validate', body: { value, type } })
  },

  getItemAvailability(id: string): Promise<{
    itemId: string
    lifecycleState: string
    isAvailable: boolean
    isRentable: boolean
    nextAvailableDate: string
    reason?: string | null
    currentHolder?: { id: string; fullName: string; phone: string } | null
  }> {
    return apiInvoke({ method: 'GET', path: `/availability/item/${id}` })
  }
}
