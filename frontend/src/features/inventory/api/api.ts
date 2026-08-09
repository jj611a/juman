import { apiInvoke } from '@/ipc/api'

export const ITEM_STATUS_VALUES = ['draft', 'active', 'inactive', 'archived', 'retired'] as const
export type ItemStatus = (typeof ITEM_STATUS_VALUES)[number]

export const ITEM_CONDITION_VALUES = ['new', 'good', 'fair', 'poor', 'unknown'] as const
export type ItemCondition = (typeof ITEM_CONDITION_VALUES)[number]

export const ITEM_LIFECYCLE_VALUES = [
  'available',
  'reserved',
  'rented',
  'return_pending',
  'inspection',
  'cleaning',
  'maintenance',
  'for_sale',
  'sold',
  'retired',
  'lost',
  'damaged',
] as const
export type ItemLifecycleState = (typeof ITEM_LIFECYCLE_VALUES)[number]

export const BARCODE_TYPE_VALUES = ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'qr'] as const
export type BarcodeType = (typeof BARCODE_TYPE_VALUES)[number]

export interface TaxonomySummary {
  id: string
  name: string
}

export interface ItemBarcode {
  id: string
  value: string
  isPrimary?: boolean
}

export interface ItemMedia {
  id: string
  mediaFileId: string
  purpose?: string | null
  isPrimary?: boolean
  displayOrder?: number
  mediaFile: {
    id: string
    originalFilename: string
    mimeType: string
    relativePath: string
  }
}

export interface ItemDto {
  id: string
  internalCode: string
  displayName: string
  purchasePrice: number | null
  rentalPrice: number | null
  salePrice: number | null
  condition: string
  status: string
  lifecycleState: string
  description: string | null
  category: TaxonomySummary | null
  brand: TaxonomySummary | null
  color: (TaxonomySummary & { hexCode: string | null }) | null
  size: TaxonomySummary | null
  barcodes: ItemBarcode[]
  media: ItemMedia[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
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
  displayName?: string
  internalCode?: string
  deleted?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface PaginatedItems {
  items: ItemDto[]
  meta: { total: number; offset: number; limit: number }
}

export interface PaginationMeta {
  total: number
  offset: number
  limit: number
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
  status?: ItemStatus
  condition?: ItemCondition
  description?: string
  barcode?: string
  generateBarcode?: boolean
  media?: Array<{
    mediaFileId: string
    purpose?: string
    isPrimary?: boolean
    displayOrder?: number
  }>
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {}

export interface AttachItemMediaPayload {
  mediaFileId: string
  purpose?: string
  isPrimary?: boolean
  displayOrder?: number
}

export interface TaxonomyDto {
  id: string
  name: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
}

export interface ColorDto extends TaxonomyDto {
  hexCode?: string | null
}

export interface CreateTaxonomyPayload {
  name: string
  description?: string
  isActive?: boolean
  sortOrder?: number
  hexCode?: string
}

export interface ItemLifecycleStateView {
  itemId: string
  lifecycleState: string
  catalogStatus: string
  isOperational: boolean
  isRentable: boolean
  isSellable: boolean
  isEditable: boolean
  updatedAt: string
}

export interface ItemLifecycleHistoryEntry {
  id: string
  oldState: string
  newState: string
  reason: string | null
  userId: string | null
  username: string | null
  referenceType: string | null
  referenceId: string | null
  createdAt: string
}

export interface TransitionItemPayload {
  newState: string
  reason?: string
  referenceType?: string
  referenceId?: string
  expectedState?: string
}

export interface BarcodeDto {
  id: string
  value: string
  type: string
  prefix: string
  status: string
  entityType: string | null
  entityId: string | null
  reservedAt: string | null
  activatedAt: string | null
  retiredAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
}

export interface GenerateBarcodePayload {
  type?: BarcodeType
  prefix?: string
  separator?: string
  padding?: number
}

export interface PublicMediaDto {
  id: string
  originalFilename: string
  storedFilename: string
  extension: string
  mimeType: string
  sizeBytes: number
  checksum: string
  width: number | null
  height: number | null
  orientation: string | null
  kind: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: string | null
  uploadedBy: string | null
}

export interface ItemAvailabilityDto {
  itemId: string
  lifecycleState: string
  isAvailable: boolean
  isRentable: boolean
  currentHolder: { id: string; fullName: string; phone: string } | null
  currentReservation: {
    id: string
    number: string
    startDate: string
    endDate: string
    status: string
  } | null
  currentRental: {
    id: string
    number: string
    startDate: string
    endDate: string
    status: string
  } | null
  nextAvailableDate: string
  reason: string | null
}

export interface RangeAvailabilityDto {
  available: boolean
  reason: string | null
  conflicts: Array<{
    type: string
    id: string
    startDate: string
    endDate: string
    status: string
  }>
}

export interface CalendarEntryDto {
  itemId: string
  type: 'reservation' | 'rental'
  status: string
  startDate: string
  endDate: string
}

export const inventoryApi = {
  list(query: ListItemsQuery): Promise<PaginatedItems> {
    return apiInvoke({ method: 'GET', path: '/items', query: query as Record<string, unknown> })
  },

  search(query: ListItemsQuery): Promise<PaginatedItems> {
    return apiInvoke({ method: 'GET', path: '/items/search', query: query as Record<string, unknown> })
  },

  getById(id: string): Promise<ItemDto> {
    return apiInvoke({ method: 'GET', path: `/items/${id}` })
  },

  getByInternalCode(internalCode: string): Promise<ItemDto> {
    return apiInvoke({ method: 'GET', path: `/items/code/${encodeURIComponent(internalCode)}` })
  },

  create(body: CreateItemPayload): Promise<ItemDto> {
    return apiInvoke({ method: 'POST', path: '/items', body })
  },

  update(id: string, body: UpdateItemPayload): Promise<ItemDto> {
    return apiInvoke({ method: 'PATCH', path: `/items/${id}`, body })
  },

  delete(id: string): Promise<ItemDto> {
    return apiInvoke({ method: 'DELETE', path: `/items/${id}` })
  },

  restore(id: string): Promise<ItemDto> {
    return apiInvoke({ method: 'POST', path: `/items/${id}/restore` })
  },

  attachMedia(id: string, body: AttachItemMediaPayload): Promise<ItemDto> {
    return apiInvoke({ method: 'POST', path: `/items/${id}/media`, body })
  },

  lifecycleState(id: string): Promise<ItemLifecycleStateView> {
    return apiInvoke({ method: 'GET', path: `/items/${id}/state` })
  },

  lifecycleHistory(id: string, query?: { offset?: number; limit?: number }): Promise<{ items: ItemLifecycleHistoryEntry[]; meta: PaginationMeta }> {
    return apiInvoke({
      method: 'GET',
      path: `/items/${id}/history`,
      query: query as Record<string, unknown> | undefined,
    })
  },

  transition(id: string, body: TransitionItemPayload): Promise<ItemLifecycleStateView> {
    return apiInvoke({ method: 'POST', path: `/items/${id}/transition`, body })
  },

  // Taxonomies
  getCategories(query?: ListTaxonomyQuery): Promise<{ items: TaxonomyDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/categories', query: query as Record<string, unknown> | undefined })
  },
  getCategory(id: string): Promise<TaxonomyDto> {
    return apiInvoke({ method: 'GET', path: `/categories/${id}` })
  },
  createCategory(body: CreateTaxonomyPayload): Promise<TaxonomyDto> {
    return apiInvoke({ method: 'POST', path: '/categories', body })
  },
  updateCategory(id: string, body: CreateTaxonomyPayload): Promise<TaxonomyDto> {
    return apiInvoke({ method: 'PATCH', path: `/categories/${id}`, body })
  },
  deleteCategory(id: string): Promise<void> {
    return apiInvoke({ method: 'DELETE', path: `/categories/${id}` })
  },
  restoreCategory(id: string): Promise<void> {
    return apiInvoke({ method: 'POST', path: `/categories/${id}/restore` })
  },

  getBrands(query?: ListTaxonomyQuery): Promise<{ items: TaxonomyDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/brands', query: query as Record<string, unknown> | undefined })
  },
  createBrand(body: CreateTaxonomyPayload): Promise<TaxonomyDto> {
    return apiInvoke({ method: 'POST', path: '/brands', body })
  },

  getColors(query?: ListTaxonomyQuery): Promise<{ items: ColorDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/colors', query: query as Record<string, unknown> | undefined })
  },
  createColor(body: CreateTaxonomyPayload): Promise<ColorDto> {
    return apiInvoke({ method: 'POST', path: '/colors', body })
  },

  getSizes(query?: ListTaxonomyQuery): Promise<{ items: TaxonomyDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/sizes', query: query as Record<string, unknown> | undefined })
  },
  createSize(body: CreateTaxonomyPayload): Promise<TaxonomyDto> {
    return apiInvoke({ method: 'POST', path: '/sizes', body })
  },

  // Barcodes
  listBarcodes(query?: ListTaxonomyQuery): Promise<{ items: BarcodeDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/barcodes', query: query as Record<string, unknown> | undefined })
  },
  getBarcode(id: string): Promise<BarcodeDto> {
    return apiInvoke({ method: 'GET', path: `/barcodes/${id}` })
  },
  generateBarcode(body: GenerateBarcodePayload = {}): Promise<BarcodeDto> {
    return apiInvoke({ method: 'POST', path: '/barcodes/generate', body })
  },
  validateBarcode(body: { value: string; type?: BarcodeType }): Promise<unknown> {
    return apiInvoke({ method: 'POST', path: '/barcodes/validate', body })
  },
  reserveBarcode(body: GenerateBarcodePayload & { value?: string }): Promise<BarcodeDto> {
    return apiInvoke({ method: 'POST', path: '/barcodes/reserve', body })
  },
  releaseBarcode(value: string): Promise<BarcodeDto> {
    return apiInvoke({ method: 'POST', path: '/barcodes/release', body: { value } })
  },
  retireBarcode(value: string): Promise<BarcodeDto> {
    return apiInvoke({ method: 'POST', path: '/barcodes/retire', body: { value } })
  },

  // Media
  listMedia(query?: ListMediaQuery): Promise<{ items: PublicMediaDto[]; meta: PaginationMeta }> {
    return apiInvoke({ method: 'GET', path: '/media', query: query as Record<string, unknown> | undefined })
  },
  getMedia(id: string): Promise<PublicMediaDto> {
    return apiInvoke({ method: 'GET', path: `/media/${id}` })
  },
  deleteMedia(id: string): Promise<PublicMediaDto> {
    return apiInvoke({ method: 'DELETE', path: `/media/${id}` })
  },
  restoreMedia(id: string): Promise<PublicMediaDto> {
    return apiInvoke({ method: 'POST', path: `/media/${id}/restore` })
  },
  uploadMedia(file: { name: string; mimeType: string; buffer: ArrayBuffer }): Promise<PublicMediaDto> {
    return window.juman.media.upload(file) as Promise<PublicMediaDto>
  },

  // Availability
  getItemAvailability(id: string): Promise<ItemAvailabilityDto | null> {
    return apiInvoke({ method: 'GET', path: `/availability/item/${id}` })
  },
  getRangeAvailability(query: { itemId: string; startDate: string; endDate: string }): Promise<RangeAvailabilityDto> {
    return apiInvoke({ method: 'GET', path: '/availability', query: query as Record<string, unknown> })
  },
  getAvailabilityCalendar(query: { start: string; end: string; itemId?: string }): Promise<CalendarEntryDto[]> {
    return apiInvoke({ method: 'GET', path: '/availability/calendar', query: query as Record<string, unknown> })
  },
}

export interface ListTaxonomyQuery {
  q?: string
  deleted?: string
  offset?: number
  limit?: number
}

export interface ListMediaQuery {
  q?: string
  kind?: string
  deleted?: string
  offset?: number
  limit?: number
}
