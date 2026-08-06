import type { SessionView } from '@shared/session'
import type { AppRuntimeConfig } from '@shared/api'
import type { ApiBinaryResult, ApiInvokeRequest } from '@shared/apiInvoke'
import type { StubResult } from '@shared/desktop'
import type {
  AuditLogDto,
  AuditLogListParams,
  CalendarAvailabilityDto,
  CalendarBlockCreateBody,
  CalendarBlockDto,
  CalendarBlockUpdateBody,
  CalendarConflictsDto,
  CategoryCreateBody,
  CategoryDto,
  CategoryListParams,
  CategoryUpdateBody,
  CustomerCreateBody,
  CustomerDto,
  CustomerListParams,
  CustomerUpdateBody,
  DressBarcodeUpdateBody,
  DressCreateBody,
  DressDto,
  DressListParams,
  DressPhotoCreateBody,
  DressPhotoDto,
  DressStatusChangeBody,
  DressUpdateBody,
  FileReferenceCreateBody,
  FileReferenceDto,
  FileReferenceListParams,
  ItemEnvelope,
  ListEnvelope,
  MessageEnvelope,
  PageListEnvelope,
  StoredFileDto
} from './domainTypes'

function bridge() {
  if (typeof window === 'undefined' || !window.juman) {
    throw new Error('Juman desktop bridge is unavailable')
  }
  return window.juman
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/** Renderer SDK — IPC only. Never imports Axios. */
export const apiClient = {
  auth: {
    getSession: (): Promise<SessionView> => bridge().auth.getSession(),
    login: (payload: {
      username: string
      password: string
      remember?: boolean
    }): Promise<SessionView> => bridge().auth.login(payload),
    changePassword: (payload: {
      currentPassword: string
      newPassword: string
    }): Promise<SessionView> => bridge().auth.changePassword(payload),
    refresh: (): Promise<{ refreshed: boolean; session: SessionView }> => bridge().auth.refresh(),
    logout: (): Promise<SessionView> => bridge().auth.logout(),
    logoutAll: (): Promise<SessionView> => bridge().auth.logoutAll(),
    isAuthenticated: (): Promise<boolean> => bridge().auth.isAuthenticated(),
    onChanged: (listener: (session: SessionView) => void): (() => void) =>
      bridge().auth.onChanged(listener)
  },
  system: {
    health: (): Promise<unknown> => bridge().api.system.health(),
    version: (): Promise<unknown> => bridge().api.system.version()
  },
  app: {
    getConfig: (): Promise<AppRuntimeConfig> => bridge().app.getConfig()
  },
  invoke: <T = unknown>(request: ApiInvokeRequest): Promise<T> => bridge().api.invoke(request),
  categories: {
    list: (params?: CategoryListParams): Promise<ListEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/categories', query: params }),
    get: (id: string): Promise<ItemEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/categories/${id}` }),
    create: (body: CategoryCreateBody): Promise<ItemEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/categories', body }),
    update: (id: string, body: CategoryUpdateBody): Promise<ItemEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/categories/${id}`, body }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/categories/${id}` }),
    activate: (id: string): Promise<ItemEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/categories/${id}/activate` }),
    deactivate: (id: string): Promise<ItemEnvelope<CategoryDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/categories/${id}/deactivate` })
  },
  customers: {
    list: (params?: CustomerListParams): Promise<ListEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/customers', query: params }),
    get: (id: string): Promise<ItemEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/customers/${id}` }),
    create: (body: CustomerCreateBody): Promise<ItemEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/customers', body }),
    update: (id: string, body: CustomerUpdateBody): Promise<ItemEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/customers/${id}`, body }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/customers/${id}` }),
    activate: (id: string): Promise<ItemEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/customers/${id}/activate` }),
    deactivate: (id: string): Promise<ItemEnvelope<CustomerDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/customers/${id}/deactivate` })
  },
  dresses: {
    list: (params?: DressListParams): Promise<PageListEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/dresses', query: params }),
    get: (id: string): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/dresses/${id}` }),
    getByBarcode: (barcode: string): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/dresses/barcode/${encodeURIComponent(barcode)}` }),
    create: (body: DressCreateBody): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/dresses', body }),
    update: (id: string, body: DressUpdateBody): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/dresses/${id}`, body }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/dresses/${id}` }),
    activate: (id: string): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/dresses/${id}/activate` }),
    deactivate: (id: string): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/dresses/${id}/deactivate` }),
    changeStatus: (id: string, body: DressStatusChangeBody): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/dresses/${id}/status`, body }),
    updateBarcode: (id: string, body: DressBarcodeUpdateBody): Promise<ItemEnvelope<DressDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/dresses/${id}/barcode`, body })
  },
  dressPhotos: {
    list: (dressId: string): Promise<{ success: boolean; data: DressPhotoDto[] }> =>
      bridge().api.invoke({ method: 'GET', path: `/dresses/${dressId}/photos` }),
    create: (dressId: string, body: DressPhotoCreateBody): Promise<ItemEnvelope<DressPhotoDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/dresses/${dressId}/photos`, body }),
    setCover: (dressId: string, photoId: string): Promise<ItemEnvelope<DressPhotoDto>> =>
      bridge().api.invoke({
        method: 'PATCH',
        path: `/dresses/${dressId}/photos/cover`,
        body: { photo_id: photoId }
      }),
    reorder: (dressId: string, photoIds: string[]): Promise<{ success: boolean; data: DressPhotoDto[] }> =>
      bridge().api.invoke({
        method: 'PATCH',
        path: `/dresses/${dressId}/photos/reorder`,
        body: { photo_ids: photoIds }
      }),
    remove: (photoId: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/dress-photos/${photoId}` })
  },
  calendar: {
    timeline: (
      dressId: string,
      params?: { from?: string; to?: string }
    ): Promise<{ success: boolean; data: CalendarBlockDto[] }> =>
      bridge().api.invoke({ method: 'GET', path: `/calendar/dress/${dressId}`, query: params }),
    availability: (
      dressId: string,
      params: { start_at: string; end_at: string }
    ): Promise<ItemEnvelope<CalendarAvailabilityDto>> =>
      bridge().api.invoke({
        method: 'GET',
        path: `/calendar/dress/${dressId}/availability`,
        query: params
      }),
    conflicts: (
      dressId: string,
      params: { start_at: string; end_at: string }
    ): Promise<ItemEnvelope<CalendarConflictsDto>> =>
      bridge().api.invoke({
        method: 'GET',
        path: `/calendar/dress/${dressId}/conflicts`,
        query: params
      }),
    createBlock: (body: CalendarBlockCreateBody): Promise<ItemEnvelope<CalendarBlockDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/calendar/block', body }),
    updateBlock: (
      blockId: string,
      body: CalendarBlockUpdateBody
    ): Promise<ItemEnvelope<CalendarBlockDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/calendar/block/${blockId}`, body }),
    deleteBlock: (blockId: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/calendar/block/${blockId}` })
  },
  media: {
    upload: async (
      file: File,
      options?: { isPublic?: boolean }
    ): Promise<ItemEnvelope<StoredFileDto>> => {
      const base64 = await fileToBase64(file)
      return bridge().api.invoke({
        method: 'POST',
        path: '/media/files',
        multipart: {
          fieldName: 'file',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64,
          fields: options?.isPublic ? { is_public: 'true' } : { is_public: 'false' }
        }
      })
    },
    getMetadata: (fileId: string): Promise<ItemEnvelope<StoredFileDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/media/files/${fileId}` }),
    downloadDataUrl: (fileId: string): Promise<ApiBinaryResult> =>
      bridge().api.invoke({
        method: 'GET',
        path: `/media/files/${fileId}/download`,
        responseType: 'binary'
      }),
    createReference: (body: FileReferenceCreateBody): Promise<ItemEnvelope<FileReferenceDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/media/references', body }),
    listReferences: (
      params?: FileReferenceListParams
    ): Promise<ListEnvelope<FileReferenceDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/media/references', query: params }),
    deleteReference: (referenceId: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/media/references/${referenceId}` })
  },
  audit: {
    listLogs: (params?: AuditLogListParams): Promise<ListEnvelope<AuditLogDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/audit/logs', query: params })
  },
  desktop: {
    dialogs: {
      message: (options: {
        type?: 'none' | 'info' | 'error' | 'question' | 'warning'
        title?: string
        message: string
      }): Promise<{ response: number }> => bridge().desktop.dialogs.message(options)
    },
    window: {
      minimize: (): Promise<boolean> => bridge().desktop.window.minimize(),
      maximize: (): Promise<boolean> => bridge().desktop.window.maximize(),
      close: (): Promise<boolean> => bridge().desktop.window.close(),
      isMaximized: (): Promise<boolean> => bridge().desktop.window.isMaximized(),
      setTitle: (title: string): Promise<boolean> => bridge().desktop.window.setTitle(title)
    },
    fs: { stub: (): Promise<StubResult> => bridge().desktop.fs.stub() },
    print: { stub: (): Promise<StubResult> => bridge().desktop.print.stub() },
    barcode: { stub: (): Promise<StubResult> => bridge().desktop.barcode.stub() }
  }
}

export type ReservationStatusCode =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'CONVERTED_TO_RENTAL'

export interface ReservationItemDto {
  id: string
  reservation_id: string
  dress_id: string
  reserved_daily_rental_price: number
  notes: string | null
  calendar_block_id: string | null
  created_at: string
  updated_at: string
}

export interface ReservationDto {
  id: string
  reservation_number: string
  customer_id: string
  reservation_at: string
  rental_start_at: string
  expected_return_at: string
  status: ReservationStatusCode | string
  notes: string | null
  items: ReservationItemDto[]
  created_at: string
  updated_at: string
}

export interface ReservationItemInput {
  dress_id: string
  reserved_daily_rental_price?: number | null
  notes?: string | null
}

export interface ReservationCreateBody {
  customer_id: string
  rental_start_at: string
  expected_return_at: string
  reservation_at?: string | null
  notes?: string | null
  items: ReservationItemInput[]
}

export interface ReservationUpdateBody {
  customer_id?: string | null
  reservation_at?: string | null
  rental_start_at?: string | null
  expected_return_at?: string | null
  notes?: string | null
  clear_notes?: boolean
  items?: ReservationItemInput[] | null
}

export interface ReservationListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  rental_from?: string
  rental_to?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type RentalStatusCode =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RETURN_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'

export type InitialPaymentTypeCode = 'FIXED_AMOUNT' | 'PERCENTAGE'

export interface RentalItemDto {
  id: string
  rental_id: string
  dress_id: string
  agreed_daily_rental_price: number
  expected_rental_days: number
  notes: string | null
  calendar_block_id: string | null
  created_at: string
  updated_at: string
}

export interface RentalDto {
  id: string
  rental_number: string
  customer_id: string
  reservation_id: string | null
  rental_at: string
  expected_return_at: string
  status: RentalStatusCode | string
  initial_payment_type: InitialPaymentTypeCode | string
  initial_payment_rate: number | null
  initial_payment_value: number
  estimated_total: number
  remaining_balance: number
  notes: string | null
  items: RentalItemDto[]
  created_at: string
  updated_at: string
}

export interface RentalItemInput {
  dress_id: string
  agreed_daily_rental_price?: number | null
  notes?: string | null
}

export interface RentalCreateBody {
  customer_id: string
  expected_return_at: string
  initial_payment_type: string
  rental_at?: string | null
  reservation_id?: string | null
  initial_payment_value?: number | null
  initial_payment_rate?: number | null
  notes?: string | null
  items?: RentalItemInput[] | null
}

export interface RentalUpdateBody {
  notes?: string | null
  clear_notes?: boolean
}

export interface RentalListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  reservation_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type ReturnStatusCode =
  | 'PENDING_INSPECTION'
  | 'INSPECTION_COMPLETED'
  | 'COMPLETED'

export interface ReturnItemDto {
  id: string
  return_id: string
  rental_item_id: string
  dress_id: string
  returned_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReturnDto {
  id: string
  return_number: string
  rental_id: string
  customer_id: string
  returned_at: string
  status: ReturnStatusCode | string
  returned_by: string | null
  notes: string | null
  items: ReturnItemDto[]
  created_at: string
  updated_at: string
}

export interface ReturnCreateBody {
  rental_id: string
  customer_id?: string | null
  returned_at?: string | null
  notes?: string | null
}

export interface ReturnListParams {
  offset?: number
  limit?: number
  status?: string
  customer_id?: string
  rental_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type InspectionStatusCode = 'PENDING' | 'COMPLETED'

export type DressConditionCode = 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE'

export interface InspectionItemDto {
  id: string
  inspection_id: string
  return_item_id: string
  dress_id: string
  condition: DressConditionCode | string | null
  repair_penalty_amount: number | null
  repair_notes: string | null
  requires_laundry: boolean
  send_to_ruined: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InspectionDto {
  id: string
  inspection_number: string
  return_id: string
  inspected_at: string | null
  inspected_by: string | null
  status: InspectionStatusCode | string
  notes: string | null
  items: InspectionItemDto[]
  created_at: string
  updated_at: string
}

export interface InspectionCreateBody {
  return_id: string
  notes?: string | null
}

export interface InspectionItemUpdateInput {
  id: string
  condition: string
  repair_penalty_amount?: number | null
  repair_notes?: string | null
  requires_laundry?: boolean
  send_to_ruined?: boolean
  notes?: string | null
}

export interface InspectionUpdateBody {
  notes?: string | null
  clear_notes?: boolean
  items?: InspectionItemUpdateInput[] | null
  complete?: boolean
}

export interface InspectionListParams {
  offset?: number
  limit?: number
  status?: string
  return_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type ProcessingStatusCode = 'PENDING' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED'

export interface ProcessingItemDto {
  id: string
  processing_batch_id: string
  dress_id: string
  inspection_item_id: string
  return_item_id: string
  rental_item_id: string
  calendar_block_id: string | null
  status: ProcessingStatusCode | string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProcessingBatchDto {
  id: string
  processing_number: string
  status: ProcessingStatusCode | string
  started_at: string | null
  mandatory_processing_end_at: string | null
  optional_extra_day_enabled: boolean
  final_processing_end_at: string | null
  completed_at: string | null
  started_by: string | null
  completed_by: string | null
  notes: string | null
  items: ProcessingItemDto[]
  created_at: string
  updated_at: string
}

export interface ProcessingCreateBody {
  inspection_item_ids: string[]
  notes?: string | null
  enable_optional_day?: boolean
}

export interface ProcessingUpdateBody {
  notes?: string | null
  clear_notes?: boolean
}

export interface ProcessingStartBody {
  enable_optional_day?: boolean | null
}

export interface ProcessingListParams {
  offset?: number
  limit?: number
  status?: string
  dress_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export type SaleOriginCode = 'NORMAL_SALE' | 'MANDATORY_DAMAGE_PURCHASE'
export type SaleStatusCode = 'COMPLETED' | 'VOIDED'
export type PaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'

export interface SaleItemDto {
  id: string
  sale_id: string
  dress_id: string
  default_sale_price: number
  actual_sale_price: number
  inspection_item_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SalePaymentDto {
  id: string
  sale_id: string
  amount: number
  payment_method: PaymentMethodCode | string
  received_at: string
  received_by: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SaleDto {
  id: string
  sale_number: string
  origin: SaleOriginCode | string
  status: SaleStatusCode | string
  customer_id: string | null
  rental_id: string | null
  return_id: string | null
  inspection_id: string | null
  total_amount: number
  sold_at: string
  sold_by: string | null
  notes: string | null
  items: SaleItemDto[]
  payments: SalePaymentDto[]
  created_at: string
  updated_at: string
}

export interface SaleItemCreateInput {
  dress_id: string
  actual_sale_price?: number | null
  notes?: string | null
}

export interface SalePaymentCreateInput {
  amount: number
  payment_method: PaymentMethodCode | string
  reference_number?: string | null
  notes?: string | null
  received_at?: string | null
}

export interface SaleCreateBody {
  origin: SaleOriginCode | string
  customer_id?: string | null
  inspection_item_id?: string | null
  items: SaleItemCreateInput[]
  payment: SalePaymentCreateInput
  notes?: string | null
}

export interface SaleListParams {
  offset?: number
  limit?: number
  status?: string
  origin?: string
  customer_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}
