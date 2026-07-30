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
  ReservationCreateBody,
  ReservationDto,
  ReservationListParams,
  ReservationUpdateBody,
  RentalCreateBody,
  RentalDto,
  RentalListParams,
  RentalUpdateBody,
  ReturnCreateBody,
  ReturnDto,
  ReturnListParams,
  InspectionCreateBody,
  InspectionDto,
  InspectionListParams,
  InspectionUpdateBody,
  ProcessingBatchDto,
  ProcessingCreateBody,
  ProcessingListParams,
  ProcessingStartBody,
  ProcessingUpdateBody,
  SaleCreateBody,
  SaleDto,
  SaleListParams,
  StoredFileDto,
  CustomersTopParams,
  CustomersTopResponseDto,
  CustomersSummaryReportDto,
  DashboardReportDto,
  FinancialDailyReportDto,
  FinancialSummaryReportDto,
  InspectionsSummaryReportDto,
  InventorySummaryReportDto,
  NeverRentedListParams,
  NeverRentedListResponseDto,
  ProcessingSummaryReportDto,
  ReportDateRangeParams,
  RentalsDetailsParams,
  RentalsDetailsResponseDto,
  RentalsSummaryReportDto,
  ReservationsSummaryReportDto,
  SalesDetailsParams,
  SalesDetailsResponseDto,
  SalesSummaryReportDto,
  SettlementAdjustmentCreateBody,
  SettlementCreateBody,
  SettlementDto,
  SettlementListParams,
  SettlementPaymentCreateBody,
  UserDto,
  UserCreateBody,
  UserUpdateBody,
  UserListParams,
  AdminResetPasswordBody,
  LoginHistoryDto,
  LoginHistoryListParams,
  RoleDto,
  RoleCreateBody,
  RoleUpdateBody,
  RolePermissionsAssignBody,
  PermissionDto,
  PermissionCreateBody,
  PermissionUpdateBody,
  ItemsEnvelope,
  SettingDto,
  SettingCategory,
  SettingUpdateBody,
  SettingValueBody,
  HealthDto,
  VersionDto,
  SystemInfoDto,
  SystemDiagnosticsDto,
  SystemMetricsDto,
  MaintenanceTaskDto,
  MaintenanceExecuteBody,
  MaintenanceRunDto,
  MaintenanceHistoryParams,
  SystemBackupDto,
  SystemBackupCreateBody,
  SystemBackupListParams,
  RestoreValidateBody,
  RestoreExecuteBody,
  RestoreHistoryDto,
  RestoreHistoryParams,
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
    health: (): Promise<HealthDto> => bridge().api.system.health(),
    version: (): Promise<VersionDto> => bridge().api.system.version(),
    info: (): Promise<SystemInfoDto> =>
      bridge().api.invoke({ method: 'GET', path: '/system/info' }),
    diagnostics: (): Promise<SystemDiagnosticsDto> =>
      bridge().api.invoke({ method: 'GET', path: '/system/diagnostics' }),
    metrics: (): Promise<SystemMetricsDto> =>
      bridge().api.invoke({ method: 'GET', path: '/system/metrics' }),
    maintenanceTasks: (): Promise<ItemsEnvelope<MaintenanceTaskDto> | { items: MaintenanceTaskDto[] }> =>
      bridge().api.invoke({ method: 'GET', path: '/system/maintenance/tasks' }),
    executeMaintenance: (
      taskKey: string,
      body?: MaintenanceExecuteBody
    ): Promise<ItemEnvelope<MaintenanceRunDto> | MaintenanceRunDto> =>
      bridge().api.invoke({
        method: 'POST',
        path: `/system/maintenance/tasks/${taskKey}/execute`,
        body
      }),
    maintenanceHistory: (
      params?: MaintenanceHistoryParams
    ): Promise<ListEnvelope<MaintenanceRunDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/system/maintenance/history', query: params }),
    maintenanceRun: (id: string): Promise<ItemEnvelope<MaintenanceRunDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/system/maintenance/history/${id}` }),
    listBackups: (params?: SystemBackupListParams): Promise<ListEnvelope<SystemBackupDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/system/backups', query: params }),
    getBackup: (id: string): Promise<ItemEnvelope<SystemBackupDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/system/backups/${id}` }),
    createBackup: (body?: SystemBackupCreateBody): Promise<ItemEnvelope<SystemBackupDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/system/backups', body }),
    deleteBackup: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/system/backups/${id}` }),
    downloadBackup: (id: string): Promise<ApiBinaryResult> =>
      bridge().api.invoke({
        method: 'GET',
        path: `/system/backups/${id}/download`,
        responseType: 'binary'
      }),
    validateRestore: (body: RestoreValidateBody): Promise<unknown> =>
      bridge().api.invoke({ method: 'POST', path: '/system/restore/validate', body }),
    restore: (body: RestoreExecuteBody): Promise<ItemEnvelope<RestoreHistoryDto> | RestoreHistoryDto> =>
      bridge().api.invoke({ method: 'POST', path: '/system/restore', body }),
    restoreHistory: (params?: RestoreHistoryParams): Promise<ListEnvelope<RestoreHistoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/system/restore/history', query: params }),
    getRestore: (id: string): Promise<ItemEnvelope<RestoreHistoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/system/restore/history/${id}` })
  },
  app: {
    getConfig: (): Promise<AppRuntimeConfig> => bridge().app.getConfig()
  },

  users: {
    list: (params?: UserListParams): Promise<ListEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/users', query: params }),
    get: (id: string): Promise<ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/users/${id}` }),
    create: (body: UserCreateBody): Promise<ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/users', body }),
    update: (id: string, body: UserUpdateBody): Promise<ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/users/${id}`, body }),
    deactivate: (id: string): Promise<ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/users/${id}/deactivate` }),
    activate: (id: string): Promise<ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/users/${id}/activate` }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/users/${id}` }),
    resetPassword: (body: AdminResetPasswordBody): Promise<MessageEnvelope | ItemEnvelope<UserDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/admin/reset-password', body }),
    loginHistory: (params?: LoginHistoryListParams): Promise<ListEnvelope<LoginHistoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/login-history', query: params }),
    userLoginHistory: (
      userId: string,
      params?: LoginHistoryListParams
    ): Promise<ListEnvelope<LoginHistoryDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/users/${userId}/login-history`, query: params })
  },
  roles: {
    list: (params?: { active_only?: boolean }): Promise<ItemsEnvelope<RoleDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/roles', query: params }),
    get: (id: string): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      bridge().api.invoke({ method: 'GET', path: `/roles/${id}` }),
    create: (body: RoleCreateBody): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      bridge().api.invoke({ method: 'POST', path: '/roles', body }),
    update: (id: string, body: RoleUpdateBody): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      bridge().api.invoke({ method: 'PUT', path: `/roles/${id}`, body }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/roles/${id}` }),
    listPermissions: (id: string): Promise<ItemsEnvelope<PermissionDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/roles/${id}/permissions` }),
    assignPermissions: (
      id: string,
      body: RolePermissionsAssignBody
    ): Promise<ItemsEnvelope<PermissionDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/roles/${id}/permissions`, body }),
    removePermission: (id: string, permissionId: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/roles/${id}/permissions/${permissionId}` })
  },
  permissions: {
    list: (params?: { module?: string }): Promise<ItemsEnvelope<PermissionDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/permissions', query: params }),
    get: (id: string): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      bridge().api.invoke({ method: 'GET', path: `/permissions/${id}` }),
    create: (body: PermissionCreateBody): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      bridge().api.invoke({ method: 'POST', path: '/permissions', body }),
    update: (
      id: string,
      body: PermissionUpdateBody
    ): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      bridge().api.invoke({ method: 'PUT', path: `/permissions/${id}`, body }),
    remove: (id: string): Promise<MessageEnvelope> =>
      bridge().api.invoke({ method: 'DELETE', path: `/permissions/${id}` })
  },
  settings: {
    list: (params?: { category?: SettingCategory | string }): Promise<ItemsEnvelope<SettingDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/settings', query: params }),
    get: (key: string): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      bridge().api.invoke({ method: 'GET', path: `/settings/${encodeURIComponent(key)}` }),
    update: (
      key: string,
      body: SettingUpdateBody
    ): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      bridge().api.invoke({ method: 'PUT', path: `/settings/${encodeURIComponent(key)}`, body }),
    patchValue: (
      key: string,
      body: SettingValueBody
    ): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      bridge().api.invoke({
        method: 'PATCH',
        path: `/settings/${encodeURIComponent(key)}/value`,
        body
      })
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
  reservations: {
    list: (params?: ReservationListParams): Promise<ListEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/reservations', query: params }),
    get: (id: string): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/reservations/${id}` }),
    create: (body: ReservationCreateBody): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/reservations', body }),
    update: (id: string, body: ReservationUpdateBody): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/reservations/${id}`, body }),
    confirm: (id: string): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/reservations/${id}/confirm` }),
    cancel: (id: string): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/reservations/${id}/cancel` }),
    expire: (id: string): Promise<ItemEnvelope<ReservationDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/reservations/${id}/expire` })
  },
  rentals: {
    list: (params?: RentalListParams): Promise<ListEnvelope<RentalDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/rentals', query: params }),
    get: (id: string): Promise<ItemEnvelope<RentalDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/rentals/${id}` }),
    create: (body: RentalCreateBody): Promise<ItemEnvelope<RentalDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/rentals', body }),
    update: (id: string, body: RentalUpdateBody): Promise<ItemEnvelope<RentalDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/rentals/${id}`, body })
  },
  returns: {
    list: (params?: ReturnListParams): Promise<ListEnvelope<ReturnDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/returns', query: params }),
    get: (id: string): Promise<ItemEnvelope<ReturnDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/returns/${id}` }),
    create: (body: ReturnCreateBody): Promise<ItemEnvelope<ReturnDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/returns', body })
  },
  inspections: {
    list: (params?: InspectionListParams): Promise<ListEnvelope<InspectionDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/inspections', query: params }),
    get: (id: string): Promise<ItemEnvelope<InspectionDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/inspections/${id}` }),
    create: (body: InspectionCreateBody): Promise<ItemEnvelope<InspectionDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/inspections', body }),
    update: (id: string, body: InspectionUpdateBody): Promise<ItemEnvelope<InspectionDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/inspections/${id}`, body })
  },
  processing: {
    list: (params?: ProcessingListParams): Promise<ListEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/processing', query: params }),
    get: (id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/processing/${id}` }),
    create: (body: ProcessingCreateBody): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/processing', body }),
    update: (id: string, body: ProcessingUpdateBody): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'PATCH', path: `/processing/${id}`, body }),
    start: (id: string, body?: ProcessingStartBody): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/processing/${id}/start`, body }),
    addOptionalDay: (id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/processing/${id}/add-optional-day` }),
    complete: (id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/processing/${id}/complete` })
  },
  sales: {
    list: (params?: SaleListParams): Promise<ListEnvelope<SaleDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/sales', query: params }),
    get: (id: string): Promise<ItemEnvelope<SaleDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/sales/${id}` }),
    create: (body: SaleCreateBody): Promise<ItemEnvelope<SaleDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/sales', body })
  },
  settlements: {
    list: (params?: SettlementListParams): Promise<ListEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'GET', path: '/rental-settlements', query: params }),
    get: (id: string): Promise<ItemEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/rental-settlements/${id}` }),
    getByRental: (rentalId: string): Promise<ItemEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/rentals/${rentalId}/settlement` }),
    create: (body: SettlementCreateBody): Promise<ItemEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'POST', path: '/rental-settlements', body }),
    collectPayment: (
      id: string,
      body: SettlementPaymentCreateBody
    ): Promise<ItemEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/rental-settlements/${id}/payments`, body }),
    adjust: (
      id: string,
      body: SettlementAdjustmentCreateBody
    ): Promise<ItemEnvelope<SettlementDto>> =>
      bridge().api.invoke({ method: 'POST', path: `/rental-settlements/${id}/adjustments`, body })
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
      bridge().api.invoke({ method: 'GET', path: '/audit/logs', query: params }),
    getLog: (id: string): Promise<ItemEnvelope<AuditLogDto>> =>
      bridge().api.invoke({ method: 'GET', path: `/audit/logs/${id}` })
  },
  reports: {
    dashboard: (): Promise<DashboardReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/dashboard' }),
    inventorySummary: (): Promise<InventorySummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/inventory/summary' }),
    inventoryNeverRented: (params?: NeverRentedListParams): Promise<NeverRentedListResponseDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/inventory/never-rented', query: params }),
    rentalsSummary: (params: ReportDateRangeParams): Promise<RentalsSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/rentals/summary', query: params }),
    rentalsDetails: (params: RentalsDetailsParams): Promise<RentalsDetailsResponseDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/rentals/details', query: params }),
    reservationsSummary: (params: ReportDateRangeParams): Promise<ReservationsSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/reservations/summary', query: params }),
    customersSummary: (params: ReportDateRangeParams): Promise<CustomersSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/customers/summary', query: params }),
    customersTop: (params?: CustomersTopParams): Promise<CustomersTopResponseDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/customers/top', query: params }),
    inspectionsSummary: (params: ReportDateRangeParams): Promise<InspectionsSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/inspections/summary', query: params }),
    processingSummary: (params: ReportDateRangeParams): Promise<ProcessingSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/processing/summary', query: params }),
    salesSummary: (params: ReportDateRangeParams): Promise<SalesSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/sales/summary', query: params }),
    salesDetails: (params: SalesDetailsParams): Promise<SalesDetailsResponseDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/sales/details', query: params }),
    financialSummary: (params: ReportDateRangeParams): Promise<FinancialSummaryReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/financial/summary', query: params }),
    financialDaily: (params: ReportDateRangeParams): Promise<FinancialDailyReportDto> =>
      bridge().api.invoke({ method: 'GET', path: '/reports/financial/daily', query: params })
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
