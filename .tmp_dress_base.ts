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
