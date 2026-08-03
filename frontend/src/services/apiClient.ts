import type { SessionView } from '@shared/session'
import type { AppRuntimeConfig } from '@shared/api'
import type { ApiBinaryResult, ApiInvokeRequest } from '@shared/apiInvoke'
import type { StubResult } from '@shared/desktop'
import type {
  BackendServiceStatus,
  CameraCapabilities,
  FirstRunState,
  HardwareDiagnosticsSnapshot,
  HardwareStationConfig,
  LabelPreview,
  PrintStatus,
  PrinterInfo,
  PrinterProbeResult,
  ScanEvent,
  UpdateCheckResult
} from '@shared/hardware'
import type {
  DiagnosticLogChunk,
  DiagnosticRepairActionId,
  DiagnosticRepairResult,
  DiagnosticsReportResult,
  DiagnosticsRunResult
} from '@shared/diagnostics'
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
  CountByKeyDto
} from './domainTypes'
import type {
  V2Category,
  V2Customer,
  V2DashboardReport,
  V2FinancialReport,
  V2Health,
  V2Item,
  V2MediaFile,
  V2Rental,
  V2Reservation,
  V2Settlement
} from './v2/contracts'
import {
  bridgeListQuery,
  dressListQuery,
  mapCategoryBodyToV2,
  mapCategoryV2ToLegacy,
  mapCustomerBodyToV2,
  mapCustomerV2ToLegacy,
  mapDashboardV2ToLegacy,
  mapDressBodyToItemV2,
  mapDressStatusToTransition,
  mapFinancialV2ToLegacy,
  mapItemV2ToDress,
  mapMediaV2ToStoredFile,
  mapRentalBodyToV2,
  mapRentalV2ToLegacy,
  mapReservationBodyToV2,
  mapReservationV2ToLegacy,
  mapSettlementAdjustmentBodyToV2,
  mapSettlementPaymentBodyToV2,
  mapSettlementV2ToLegacy,
  toLegacyItem,
  toLegacyList,
  toLegacyMessage,
  toPageListEnvelope,
  unwrapV2Page
} from './v2/legacyBridge'
import { v2Unsupported } from './v2/unsupported'

function bridge() {
  if (typeof window === 'undefined' || !window.juman) {
    throw new Error('Juman desktop bridge is unavailable')
  }
  return window.juman
}

async function invoke<T = unknown>(request: ApiInvokeRequest): Promise<T> {
  return bridge().api.invoke(request) as Promise<T>
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

function asCountRows(raw: unknown): CountByKeyDto[] {
  const { items } = unwrapV2Page<Record<string, unknown>>(raw)
  return items.map((row) => ({
    key: String(row.key ?? row.name ?? row.label ?? row.id ?? ''),
    count: Number(row.count ?? row.total ?? row.value ?? 0)
  }))
}

/** Renderer SDK — IPC only. Never imports Axios. Targets Nest Backend V2. */
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
    health: async (): Promise<HealthDto> => {
      const h = await invoke<V2Health>({ method: 'GET', path: '/health' })
      return {
        status: h.status,
        database: h.database,
        redis: 'n/a',
        app: 'backend-node',
        environment: h.environment,
        version: h.version,
        uptime: h.uptime
      }
    },
    version: async (): Promise<VersionDto> => {
      const h = await invoke<V2Health>({ method: 'GET', path: '/health' })
      return {
        name: 'Juman',
        name_ar: 'جمان',
        version: h.version,
        api: 'backend-node',
        environment: h.environment
      }
    },
    info: (): Promise<SystemInfoDto> => v2Unsupported('system.info'),
    diagnostics: (): Promise<SystemDiagnosticsDto> => v2Unsupported('system.diagnostics'),
    metrics: (): Promise<SystemMetricsDto> => v2Unsupported('system.metrics'),
    maintenanceTasks: (): Promise<ItemsEnvelope<MaintenanceTaskDto> | { items: MaintenanceTaskDto[] }> =>
      v2Unsupported('system.maintenance'),
    executeMaintenance: (
      _taskKey: string,
      _body?: MaintenanceExecuteBody
    ): Promise<ItemEnvelope<MaintenanceRunDto> | MaintenanceRunDto> =>
      v2Unsupported('system.maintenance'),
    maintenanceHistory: (_params?: MaintenanceHistoryParams): Promise<ListEnvelope<MaintenanceRunDto>> =>
      v2Unsupported('system.maintenance'),
    maintenanceRun: (_id: string): Promise<ItemEnvelope<MaintenanceRunDto>> =>
      v2Unsupported('system.maintenance'),
    listBackups: (_params?: SystemBackupListParams): Promise<ListEnvelope<SystemBackupDto>> =>
      v2Unsupported('system.backups'),
    getBackup: (_id: string): Promise<ItemEnvelope<SystemBackupDto>> =>
      v2Unsupported('system.backups'),
    createBackup: (_body?: SystemBackupCreateBody): Promise<ItemEnvelope<SystemBackupDto>> =>
      v2Unsupported('system.backups'),
    deleteBackup: (_id: string): Promise<MessageEnvelope> => v2Unsupported('system.backups'),
    downloadBackup: (_id: string): Promise<ApiBinaryResult> => v2Unsupported('system.backups'),
    validateRestore: (_body: RestoreValidateBody): Promise<unknown> =>
      v2Unsupported('system.restore'),
    restore: (
      _body: RestoreExecuteBody
    ): Promise<ItemEnvelope<RestoreHistoryDto> | RestoreHistoryDto> =>
      v2Unsupported('system.restore'),
    restoreHistory: (_params?: RestoreHistoryParams): Promise<ListEnvelope<RestoreHistoryDto>> =>
      v2Unsupported('system.restore'),
    getRestore: (_id: string): Promise<ItemEnvelope<RestoreHistoryDto>> =>
      v2Unsupported('system.restore')
  },
  app: {
    getConfig: (): Promise<AppRuntimeConfig> => bridge().app.getConfig(),
    getVersion: (): Promise<string> => bridge().app.getVersion()
  },

  users: {
    list: (_params?: UserListParams): Promise<ListEnvelope<UserDto>> =>
      v2Unsupported('users.list'),
    get: (_id: string): Promise<ItemEnvelope<UserDto>> => v2Unsupported('users.get'),
    create: (_body: UserCreateBody): Promise<ItemEnvelope<UserDto>> =>
      v2Unsupported('users.create'),
    update: (_id: string, _body: UserUpdateBody): Promise<ItemEnvelope<UserDto>> =>
      v2Unsupported('users.update'),
    deactivate: (_id: string): Promise<ItemEnvelope<UserDto>> =>
      v2Unsupported('users.deactivate'),
    activate: (_id: string): Promise<ItemEnvelope<UserDto>> => v2Unsupported('users.activate'),
    remove: (_id: string): Promise<MessageEnvelope> => v2Unsupported('users.remove'),
    resetPassword: (
      _body: AdminResetPasswordBody
    ): Promise<MessageEnvelope | ItemEnvelope<UserDto>> => v2Unsupported('users.resetPassword'),
    loginHistory: (_params?: LoginHistoryListParams): Promise<ListEnvelope<LoginHistoryDto>> =>
      v2Unsupported('users.loginHistory'),
    userLoginHistory: (
      _userId: string,
      _params?: LoginHistoryListParams
    ): Promise<ListEnvelope<LoginHistoryDto>> => v2Unsupported('users.loginHistory')
  },
  roles: {
    list: (_params?: { active_only?: boolean }): Promise<ItemsEnvelope<RoleDto>> =>
      v2Unsupported('roles.list'),
    get: (_id: string): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      v2Unsupported('roles.get'),
    create: (
      _body: RoleCreateBody
    ): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      v2Unsupported('roles.create'),
    update: (
      _id: string,
      _body: RoleUpdateBody
    ): Promise<ItemEnvelope<RoleDto> | { success: boolean; item: RoleDto }> =>
      v2Unsupported('roles.update'),
    remove: (_id: string): Promise<MessageEnvelope> => v2Unsupported('roles.remove'),
    listPermissions: (_id: string): Promise<ItemsEnvelope<PermissionDto>> =>
      v2Unsupported('roles.permissions'),
    assignPermissions: (
      _id: string,
      _body: RolePermissionsAssignBody
    ): Promise<ItemsEnvelope<PermissionDto>> => v2Unsupported('roles.permissions'),
    removePermission: (_id: string, _permissionId: string): Promise<MessageEnvelope> =>
      v2Unsupported('roles.permissions')
  },
  permissions: {
    list: (_params?: { module?: string }): Promise<ItemsEnvelope<PermissionDto>> =>
      v2Unsupported('permissions.list'),
    get: (
      _id: string
    ): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      v2Unsupported('permissions.get'),
    create: (
      _body: PermissionCreateBody
    ): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      v2Unsupported('permissions.create'),
    update: (
      _id: string,
      _body: PermissionUpdateBody
    ): Promise<ItemEnvelope<PermissionDto> | { success: boolean; item: PermissionDto }> =>
      v2Unsupported('permissions.update'),
    remove: (_id: string): Promise<MessageEnvelope> => v2Unsupported('permissions.remove')
  },
  settings: {
    list: (_params?: { category?: SettingCategory | string }): Promise<ItemsEnvelope<SettingDto>> =>
      v2Unsupported('settings.list'),
    get: (
      _key: string
    ): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      v2Unsupported('settings.get'),
    update: (
      _key: string,
      _body: SettingUpdateBody
    ): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      v2Unsupported('settings.update'),
    patchValue: (
      _key: string,
      _body: SettingValueBody
    ): Promise<ItemEnvelope<SettingDto> | { success: boolean; item: SettingDto }> =>
      v2Unsupported('settings.patchValue')
  },
  invoke: <T = unknown>(request: ApiInvokeRequest): Promise<T> => bridge().api.invoke(request),

  categories: {
    list: async (params?: CategoryListParams): Promise<ListEnvelope<CategoryDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/categories',
        query: bridgeListQuery(params as Record<string, unknown>)
      })
      const page = unwrapV2Page<V2Category>(raw)
      return toLegacyList(page.items, page.meta, mapCategoryV2ToLegacy)
    },
    get: async (id: string): Promise<ItemEnvelope<CategoryDto>> => {
      const raw = await invoke<V2Category>({ method: 'GET', path: `/categories/${id}` })
      return toLegacyItem(raw, mapCategoryV2ToLegacy)
    },
    create: async (body: CategoryCreateBody): Promise<ItemEnvelope<CategoryDto>> => {
      const raw = await invoke<V2Category>({
        method: 'POST',
        path: '/categories',
        body: mapCategoryBodyToV2(body as unknown as Record<string, unknown>)
      })
      return toLegacyItem(raw, mapCategoryV2ToLegacy)
    },
    update: async (id: string, body: CategoryUpdateBody): Promise<ItemEnvelope<CategoryDto>> => {
      const raw = await invoke<V2Category>({
        method: 'PATCH',
        path: `/categories/${id}`,
        body: mapCategoryBodyToV2(body as unknown as Record<string, unknown>)
      })
      return toLegacyItem(raw, mapCategoryV2ToLegacy)
    },
    remove: async (id: string): Promise<MessageEnvelope> => {
      await invoke({ method: 'DELETE', path: `/categories/${id}` })
      return toLegacyMessage()
    },
    activate: async (id: string): Promise<ItemEnvelope<CategoryDto>> => {
      const raw = await invoke<V2Category>({
        method: 'PATCH',
        path: `/categories/${id}`,
        body: { isActive: true }
      })
      return toLegacyItem(raw, mapCategoryV2ToLegacy)
    },
    deactivate: async (id: string): Promise<ItemEnvelope<CategoryDto>> => {
      const raw = await invoke<V2Category>({
        method: 'PATCH',
        path: `/categories/${id}`,
        body: { isActive: false }
      })
      return toLegacyItem(raw, mapCategoryV2ToLegacy)
    }
  },

  customers: {
    list: async (params?: CustomerListParams): Promise<ListEnvelope<CustomerDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/customers',
        query: bridgeListQuery(params as Record<string, unknown>)
      })
      const page = unwrapV2Page<V2Customer>(raw)
      return toLegacyList(page.items, page.meta, mapCustomerV2ToLegacy)
    },
    get: async (id: string): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({ method: 'GET', path: `/customers/${id}` })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    },
    create: async (body: CustomerCreateBody): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({
        method: 'POST',
        path: '/customers',
        body: mapCustomerBodyToV2(body)
      })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    },
    update: async (id: string, body: CustomerUpdateBody): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({
        method: 'PATCH',
        path: `/customers/${id}`,
        body: mapCustomerBodyToV2(body)
      })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    },
    remove: async (id: string): Promise<MessageEnvelope> => {
      await invoke({ method: 'DELETE', path: `/customers/${id}` })
      return toLegacyMessage()
    },
    activate: async (id: string): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({
        method: 'PATCH',
        path: `/customers/${id}`,
        body: { status: 'active' }
      })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    },
    deactivate: async (id: string): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({
        method: 'PATCH',
        path: `/customers/${id}`,
        body: { status: 'inactive' }
      })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    },
    restore: async (id: string): Promise<ItemEnvelope<CustomerDto>> => {
      const raw = await invoke<V2Customer>({
        method: 'POST',
        path: `/customers/${id}/restore`
      })
      return toLegacyItem(raw, mapCustomerV2ToLegacy)
    }
  },

  dresses: {
    list: async (params?: DressListParams): Promise<PageListEnvelope<DressDto>> => {
      const query = dressListQuery(params as Record<string, unknown>)
      const raw = await invoke({ method: 'GET', path: '/items', query })
      const page = unwrapV2Page<V2Item>(raw)
      const dresses = page.items.map(mapItemV2ToDress)
      return toPageListEnvelope(
        dresses,
        page.meta,
        params?.page,
        params?.page_size
      )
    },
    get: async (id: string): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({ method: 'GET', path: `/items/${id}` })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    getByBarcode: async (barcode: string): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/items',
        query: { barcode, limit: 1, offset: 0 }
      })
      const page = unwrapV2Page<V2Item>(raw)
      const item = page.items[0]
      if (!item) {
        const err = {
          code: 'NOT_FOUND',
          message: `No item found for barcode ${barcode}`
        }
        throw err
      }
      return toLegacyItem(item, mapItemV2ToDress)
    },
    create: async (body: DressCreateBody): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({
        method: 'POST',
        path: '/items',
        body: mapDressBodyToItemV2(body)
      })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    update: async (id: string, body: DressUpdateBody): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({
        method: 'PATCH',
        path: `/items/${id}`,
        body: mapDressBodyToItemV2(body)
      })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    remove: async (id: string): Promise<MessageEnvelope> => {
      await invoke({ method: 'DELETE', path: `/items/${id}` })
      return toLegacyMessage()
    },
    activate: async (id: string): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({
        method: 'PATCH',
        path: `/items/${id}`,
        body: { status: 'active' }
      })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    deactivate: async (id: string): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({
        method: 'PATCH',
        path: `/items/${id}`,
        body: { status: 'inactive' }
      })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    changeStatus: async (
      id: string,
      body: DressStatusChangeBody
    ): Promise<ItemEnvelope<DressDto>> => {
      await invoke({
        method: 'POST',
        path: `/items/${id}/transition`,
        body: {
          newState: mapDressStatusToTransition(body.new_status),
          reason: body.reason ?? undefined
        }
      })
      const raw = await invoke<V2Item>({ method: 'GET', path: `/items/${id}` })
      return toLegacyItem(raw, mapItemV2ToDress)
    },
    updateBarcode: async (
      id: string,
      body: DressBarcodeUpdateBody
    ): Promise<ItemEnvelope<DressDto>> => {
      const raw = await invoke<V2Item>({
        method: 'PATCH',
        path: `/items/${id}`,
        body: { barcode: body.barcode ?? undefined }
      })
      return toLegacyItem(raw, mapItemV2ToDress)
    }
  },

  dressPhotos: {
    list: (_dressId: string): Promise<{ success: boolean; data: DressPhotoDto[] }> =>
      v2Unsupported('dressPhotos.list — use item media embed / POST /items/:id/media'),
    create: (
      _dressId: string,
      _body: DressPhotoCreateBody
    ): Promise<ItemEnvelope<DressPhotoDto>> => v2Unsupported('dressPhotos.create'),
    setCover: (_dressId: string, _photoId: string): Promise<ItemEnvelope<DressPhotoDto>> =>
      v2Unsupported('dressPhotos.setCover'),
    reorder: (
      _dressId: string,
      _photoIds: string[]
    ): Promise<{ success: boolean; data: DressPhotoDto[] }> =>
      v2Unsupported('dressPhotos.reorder'),
    remove: (_photoId: string): Promise<MessageEnvelope> => v2Unsupported('dressPhotos.remove')
  },

  calendar: {
    timeline: (
      _dressId: string,
      _params?: { from?: string; to?: string }
    ): Promise<{ success: boolean; data: CalendarBlockDto[] }> =>
      v2Unsupported('calendar.timeline'),
    availability: (
      _dressId: string,
      _params: { start_at: string; end_at: string }
    ): Promise<ItemEnvelope<CalendarAvailabilityDto>> => v2Unsupported('calendar.availability'),
    conflicts: (
      _dressId: string,
      _params: { start_at: string; end_at: string }
    ): Promise<ItemEnvelope<CalendarConflictsDto>> => v2Unsupported('calendar.conflicts'),
    createBlock: (_body: CalendarBlockCreateBody): Promise<ItemEnvelope<CalendarBlockDto>> =>
      v2Unsupported('calendar.createBlock'),
    updateBlock: (
      _blockId: string,
      _body: CalendarBlockUpdateBody
    ): Promise<ItemEnvelope<CalendarBlockDto>> => v2Unsupported('calendar.updateBlock'),
    deleteBlock: (_blockId: string): Promise<MessageEnvelope> =>
      v2Unsupported('calendar.deleteBlock')
  },

  reservations: {
    list: async (params?: ReservationListParams): Promise<ListEnvelope<ReservationDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/reservations',
        query: bridgeListQuery(params as Record<string, unknown>)
      })
      const page = unwrapV2Page<V2Reservation>(raw)
      return toLegacyList(page.items, page.meta, mapReservationV2ToLegacy)
    },
    get: async (id: string): Promise<ItemEnvelope<ReservationDto>> => {
      const raw = await invoke<V2Reservation>({ method: 'GET', path: `/reservations/${id}` })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    },
    create: async (body: ReservationCreateBody): Promise<ItemEnvelope<ReservationDto>> => {
      const raw = await invoke<V2Reservation>({
        method: 'POST',
        path: '/reservations',
        body: mapReservationBodyToV2(body)
      })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    },
    update: (
      _id: string,
      _body: ReservationUpdateBody
    ): Promise<ItemEnvelope<ReservationDto>> =>
      v2Unsupported('reservations.update — V2 has no PATCH; cancel/recreate'),
    confirm: async (id: string): Promise<ItemEnvelope<ReservationDto>> => {
      // V2 create confirms; re-fetch as confirm no-op.
      const raw = await invoke<V2Reservation>({ method: 'GET', path: `/reservations/${id}` })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    },
    cancel: async (id: string): Promise<ItemEnvelope<ReservationDto>> => {
      const raw = await invoke<V2Reservation>({
        method: 'POST',
        path: `/reservations/${id}/cancel`
      })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    },
    expire: async (id: string): Promise<ItemEnvelope<ReservationDto>> => {
      const raw = await invoke<V2Reservation>({
        method: 'POST',
        path: `/reservations/${id}/expire`
      })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    },
    checkout: async (
      id: string,
      body?: { depositAmountFils?: number; reason?: string; idempotencyKey?: string }
    ): Promise<ItemEnvelope<ReservationDto>> => {
      const raw = await invoke<V2Reservation>({
        method: 'POST',
        path: `/reservations/${id}/checkout`,
        body
      })
      return toLegacyItem(raw, mapReservationV2ToLegacy)
    }
  },

  rentals: {
    list: async (params?: RentalListParams): Promise<ListEnvelope<RentalDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/rentals',
        query: bridgeListQuery(params as Record<string, unknown>)
      })
      const page = unwrapV2Page<V2Rental>(raw)
      return toLegacyList(page.items, page.meta, mapRentalV2ToLegacy)
    },
    get: async (id: string): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({ method: 'GET', path: `/rentals/${id}` })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    },
    create: async (body: RentalCreateBody): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({
        method: 'POST',
        path: '/rentals',
        body: mapRentalBodyToV2(body)
      })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    },
    update: (_id: string, _body: RentalUpdateBody): Promise<ItemEnvelope<RentalDto>> =>
      v2Unsupported('rentals.update — use checkout/return/complete/cancel'),
    checkout: async (
      id: string,
      body?: { depositAmountFils?: number; reason?: string; idempotencyKey?: string }
    ): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({
        method: 'POST',
        path: `/rentals/${id}/checkout`,
        body
      })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    },
    return: async (
      id: string,
      body?: { reason?: string; idempotencyKey?: string }
    ): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({
        method: 'POST',
        path: `/rentals/${id}/return`,
        body
      })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    },
    complete: async (
      id: string,
      body?: { reason?: string }
    ): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({
        method: 'POST',
        path: `/rentals/${id}/complete`,
        body
      })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    },
    cancel: async (
      id: string,
      body?: { reason?: string }
    ): Promise<ItemEnvelope<RentalDto>> => {
      const raw = await invoke<V2Rental>({
        method: 'POST',
        path: `/rentals/${id}/cancel`,
        body
      })
      return toLegacyItem(raw, mapRentalV2ToLegacy)
    }
  },

  returns: {
    list: (_params?: ReturnListParams): Promise<ListEnvelope<ReturnDto>> =>
      v2Unsupported('returns module'),
    get: (_id: string): Promise<ItemEnvelope<ReturnDto>> => v2Unsupported('returns module'),
    create: (_body: ReturnCreateBody): Promise<ItemEnvelope<ReturnDto>> =>
      v2Unsupported('returns module — use rentals.return')
  },
  inspections: {
    list: (_params?: InspectionListParams): Promise<ListEnvelope<InspectionDto>> =>
      v2Unsupported('inspections module'),
    get: (_id: string): Promise<ItemEnvelope<InspectionDto>> =>
      v2Unsupported('inspections module'),
    create: (_body: InspectionCreateBody): Promise<ItemEnvelope<InspectionDto>> =>
      v2Unsupported('inspections module'),
    update: (_id: string, _body: InspectionUpdateBody): Promise<ItemEnvelope<InspectionDto>> =>
      v2Unsupported('inspections module')
  },
  processing: {
    list: (_params?: ProcessingListParams): Promise<ListEnvelope<ProcessingBatchDto>> =>
      v2Unsupported('processing module'),
    get: (_id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      v2Unsupported('processing module'),
    create: (_body: ProcessingCreateBody): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      v2Unsupported('processing module'),
    update: (
      _id: string,
      _body: ProcessingUpdateBody
    ): Promise<ItemEnvelope<ProcessingBatchDto>> => v2Unsupported('processing module'),
    start: (
      _id: string,
      _body?: ProcessingStartBody
    ): Promise<ItemEnvelope<ProcessingBatchDto>> => v2Unsupported('processing module'),
    addOptionalDay: (_id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      v2Unsupported('processing module'),
    complete: (_id: string): Promise<ItemEnvelope<ProcessingBatchDto>> =>
      v2Unsupported('processing module')
  },
  sales: {
    list: (_params?: SaleListParams): Promise<ListEnvelope<SaleDto>> =>
      v2Unsupported('sales module'),
    get: (_id: string): Promise<ItemEnvelope<SaleDto>> => v2Unsupported('sales module'),
    create: (_body: SaleCreateBody): Promise<ItemEnvelope<SaleDto>> =>
      v2Unsupported('sales module')
  },

  settlements: {
    list: async (params?: SettlementListParams): Promise<ListEnvelope<SettlementDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/settlements',
        query: bridgeListQuery(params as Record<string, unknown>)
      })
      const page = unwrapV2Page<V2Settlement>(raw)
      return toLegacyList(page.items, page.meta, mapSettlementV2ToLegacy)
    },
    get: async (id: string): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({ method: 'GET', path: `/settlements/${id}` })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    getByRental: async (rentalId: string): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke({
        method: 'GET',
        path: '/settlements',
        query: { rentalId, limit: 1, offset: 0 }
      })
      const page = unwrapV2Page<V2Settlement>(raw)
      const row = page.items[0]
      if (!row) {
        throw { code: 'NOT_FOUND', message: `No settlement for rental ${rentalId}` }
      }
      return toLegacyItem(row, mapSettlementV2ToLegacy)
    },
    create: (_body: SettlementCreateBody): Promise<ItemEnvelope<SettlementDto>> =>
      v2Unsupported('settlements.create — settlements are created by rental checkout'),
    collectPayment: async (
      id: string,
      body: SettlementPaymentCreateBody
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/payment`,
        body: mapSettlementPaymentBodyToV2(body)
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    adjust: async (
      id: string,
      body: SettlementAdjustmentCreateBody
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/adjustment`,
        body: mapSettlementAdjustmentBodyToV2(body)
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    refund: async (
      id: string,
      body: { amountFils: number; reason: string; idempotencyKey?: string }
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/refund`,
        body
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    discount: async (
      id: string,
      body: Record<string, unknown>
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/discount`,
        body
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    lateFee: async (
      id: string,
      body: Record<string, unknown>
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/late-fee`,
        body
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    close: async (
      id: string,
      body?: { reason?: string }
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/close`,
        body
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    },
    cancel: async (
      id: string,
      body?: { reason?: string }
    ): Promise<ItemEnvelope<SettlementDto>> => {
      const raw = await invoke<V2Settlement>({
        method: 'POST',
        path: `/settlements/${id}/cancel`,
        body
      })
      return toLegacyItem(raw, mapSettlementV2ToLegacy)
    }
  },

  media: {
    upload: async (
      file: File,
      options?: { isPublic?: boolean }
    ): Promise<ItemEnvelope<StoredFileDto>> => {
      const base64 = await fileToBase64(file)
      const raw = await invoke<V2MediaFile>({
        method: 'POST',
        path: '/media',
        multipart: {
          fieldName: 'file',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64,
          fields: options?.isPublic ? { isPublic: 'true' } : undefined
        }
      })
      return toLegacyItem(raw, mapMediaV2ToStoredFile)
    },
    getMetadata: async (fileId: string): Promise<ItemEnvelope<StoredFileDto>> => {
      const raw = await invoke<V2MediaFile>({ method: 'GET', path: `/media/${fileId}` })
      return toLegacyItem(raw, mapMediaV2ToStoredFile)
    },
    downloadDataUrl: (_fileId: string): Promise<ApiBinaryResult> =>
      v2Unsupported('media.download — V2 has no binary download route yet'),
    createReference: (_body: FileReferenceCreateBody): Promise<ItemEnvelope<FileReferenceDto>> =>
      v2Unsupported('media.references — use POST /items/:id/media'),
    listReferences: (
      _params?: FileReferenceListParams
    ): Promise<ListEnvelope<FileReferenceDto>> =>
      v2Unsupported('media.references'),
    deleteReference: (_referenceId: string): Promise<MessageEnvelope> =>
      v2Unsupported('media.references')
  },

  audit: {
    listLogs: (_params?: AuditLogListParams): Promise<ListEnvelope<AuditLogDto>> =>
      v2Unsupported('audit.logs'),
    getLog: (_id: string): Promise<ItemEnvelope<AuditLogDto>> => v2Unsupported('audit.logs')
  },

  reports: {
    dashboard: async (): Promise<DashboardReportDto> => {
      const raw = await invoke<V2DashboardReport>({ method: 'GET', path: '/reports/dashboard' })
      return mapDashboardV2ToLegacy(raw)
    },
    inventorySummary: async (): Promise<InventorySummaryReportDto> => {
      const [lifecycle, category, brand, color, size, availability] = await Promise.all([
        invoke({ method: 'GET', path: '/reports/inventory/lifecycle' }),
        invoke({ method: 'GET', path: '/reports/inventory/category' }),
        invoke({ method: 'GET', path: '/reports/inventory/brand' }),
        invoke({ method: 'GET', path: '/reports/inventory/color' }),
        invoke({ method: 'GET', path: '/reports/inventory/size' }),
        invoke({ method: 'GET', path: '/reports/inventory/availability' })
      ])
      const byStatus: Record<string, number> = {}
      for (const row of asCountRows(lifecycle)) {
        byStatus[row.key] = row.count
      }
      const avail = availability as Record<string, unknown>
      const total = Number(
        avail.total ?? avail.inventoryCount ?? Object.values(byStatus).reduce((a, b) => a + b, 0)
      )
      return {
        dresses_total: total,
        dresses_by_status: byStatus,
        by_category: asCountRows(category),
        by_size: asCountRows(size),
        by_colour: asCountRows(color),
        by_brand: asCountRows(brand)
      }
    },
    inventoryNeverRented: (_params?: NeverRentedListParams): Promise<NeverRentedListResponseDto> =>
      v2Unsupported('reports.inventory.never-rented'),
    rentalsSummary: async (params: ReportDateRangeParams): Promise<RentalsSummaryReportDto> => {
      const query = bridgeListQuery(params as unknown as Record<string, unknown>)
      const [current, overdue, history] = await Promise.all([
        invoke({ method: 'GET', path: '/reports/rentals/current', query }),
        invoke({ method: 'GET', path: '/reports/rentals/overdue', query }),
        invoke({ method: 'GET', path: '/reports/rentals/history', query })
      ])
      const cur = unwrapV2Page(current)
      const od = unwrapV2Page(overdue)
      const hist = unwrapV2Page(history)
      return {
        date_from: params.date_from,
        date_to: params.date_to,
        created_in_range_total: hist.meta.total,
        active_now: cur.meta.total,
        overdue_now: od.meta.total,
        completed_settled_in_range: 0,
        most_rented: [],
        created_in_range_by_status: {}
      }
    },
    rentalsDetails: async (params: RentalsDetailsParams): Promise<RentalsDetailsResponseDto> => {
      const query = bridgeListQuery(params as unknown as Record<string, unknown>)
      const raw = await invoke({ method: 'GET', path: '/reports/rentals/history', query })
      const page = unwrapV2Page<Record<string, unknown>>(raw)
      return {
        items: page.items.map((row) => ({
          id: String(row.id ?? ''),
          rental_number: String(row.rentalNumber ?? row.rental_number ?? ''),
          customer_id: String(row.customerId ?? row.customer_id ?? ''),
          status: String(row.status ?? ''),
          rental_at: String(row.rentalDate ?? row.rental_at ?? ''),
          expected_return_at: String(row.expectedReturnDate ?? row.expected_return_at ?? ''),
          estimated_total: Number(
            (row.settlement as { totalFils?: number } | undefined)?.totalFils ?? 0
          ),
          duration_seconds: null
        })),
        meta: page.meta
      }
    },
    reservationsSummary: async (
      params: ReportDateRangeParams
    ): Promise<ReservationsSummaryReportDto> => {
      const query = bridgeListQuery(params as unknown as Record<string, unknown>)
      const raw = await invoke({
        method: 'GET',
        path: '/reports/rentals/reservations',
        query
      })
      const page = unwrapV2Page(raw)
      return {
        date_from: params.date_from,
        date_to: params.date_to,
        created_in_range_by_status: {},
        created_in_range_total: page.meta.total,
        upcoming_confirmed: page.meta.total,
        by_customer: [],
        by_cashier: []
      }
    },
    customersSummary: (_params: ReportDateRangeParams): Promise<CustomersSummaryReportDto> =>
      v2Unsupported('reports.customers.summary — use /reports/customers/:id/*'),
    customersTop: (_params?: CustomersTopParams): Promise<CustomersTopResponseDto> =>
      v2Unsupported('reports.customers.top'),
    inspectionsSummary: (_params: ReportDateRangeParams): Promise<InspectionsSummaryReportDto> =>
      v2Unsupported('reports.inspections'),
    processingSummary: (_params: ReportDateRangeParams): Promise<ProcessingSummaryReportDto> =>
      v2Unsupported('reports.processing'),
    salesSummary: (_params: ReportDateRangeParams): Promise<SalesSummaryReportDto> =>
      v2Unsupported('reports.sales'),
    salesDetails: (_params: SalesDetailsParams): Promise<SalesDetailsResponseDto> =>
      v2Unsupported('reports.sales'),
    financialSummary: async (
      params: ReportDateRangeParams
    ): Promise<FinancialSummaryReportDto> => {
      const query = bridgeListQuery(params as unknown as Record<string, unknown>)
      const raw = await invoke<V2FinancialReport>({
        method: 'GET',
        path: '/reports/financial',
        query
      })
      return mapFinancialV2ToLegacy(raw, {
        date_from: params.date_from,
        date_to: params.date_to
      })
    },
    financialDaily: (_params: ReportDateRangeParams): Promise<FinancialDailyReportDto> =>
      v2Unsupported('reports.financial.daily — V2 returns aggregate /reports/financial only'),
    export: async (params: {
      report: string
      format: 'csv' | 'json'
      from?: string
      to?: string
    }): Promise<unknown> =>
      invoke({
        method: 'GET',
        path: '/reports/export',
        query: params
      }),
    exportCsv: (report: string, params?: ReportDateRangeParams): Promise<unknown> =>
      invoke({
        method: 'GET',
        path: '/reports/export',
        query: {
          report,
          format: 'csv',
          ...(bridgeListQuery(params as unknown as Record<string, unknown>) ?? {})
        }
      }),
    exportJson: (report: string, params?: ReportDateRangeParams): Promise<unknown> =>
      invoke({
        method: 'GET',
        path: '/reports/export',
        query: {
          report,
          format: 'json',
          ...(bridgeListQuery(params as unknown as Record<string, unknown>) ?? {})
        }
      })
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
    fs: { stub: (): Promise<StubResult> => bridge().desktop.fs.stub() }
  },
  hardware: {
    getConfig: (): Promise<HardwareStationConfig> => bridge().hardware.getConfig(),
    setConfig: (patch: Partial<HardwareStationConfig>): Promise<HardwareStationConfig> =>
      bridge().hardware.setConfig(patch),
    listPrinters: (): Promise<PrinterInfo[]> => bridge().hardware.listPrinters(),
    probePrinter: (): Promise<PrinterProbeResult> => bridge().hardware.probePrinter(),
    diagnostics: (): Promise<HardwareDiagnosticsSnapshot> => bridge().hardware.diagnostics(),
    testReceipt: (): Promise<PrintStatus> => bridge().hardware.testReceipt(),
    previewLabel: (payload: { barcode: string; title?: string | null }): Promise<LabelPreview> =>
      bridge().hardware.previewLabel(payload),
    printLabel: (payload: { barcode: string; title?: string | null }): Promise<PrintStatus> =>
      bridge().hardware.printLabel(payload),
    openDrawer: (): Promise<PrintStatus> => bridge().hardware.openDrawer(),
    cameraCapabilities: (): Promise<CameraCapabilities> => bridge().hardware.cameraCapabilities(),
    backendStatus: (): Promise<BackendServiceStatus> => bridge().hardware.backendStatus(),
    startBackend: (): Promise<BackendServiceStatus> => bridge().hardware.startBackend(),
    stopBackend: (): Promise<BackendServiceStatus> => bridge().hardware.stopBackend(),
    restartBackend: (): Promise<BackendServiceStatus> => bridge().hardware.restartBackend(),
    repairBackend: (): Promise<BackendServiceStatus> => bridge().hardware.repairBackend(),
    openLogs: (): Promise<boolean> => bridge().hardware.openLogs(),
    onScan: (listener: (event: ScanEvent) => void): (() => void) =>
      bridge().hardware.onScan(listener)
  },
  appExtras: {
    getFirstRunState: (): Promise<FirstRunState> => bridge().app.getFirstRunState(),
    completeFirstRun: (): Promise<FirstRunState> => bridge().app.completeFirstRun(),
    checkUpdates: (): Promise<UpdateCheckResult> => bridge().app.checkUpdates(),
    readEnv: (): Promise<Record<string, string>> => bridge().app.readEnv(),
    patchEnv: (updates: Record<string, string>): Promise<Record<string, string>> =>
      bridge().app.patchEnv(updates)
  },
  diagnostics: {
    run: (): Promise<DiagnosticsRunResult> => bridge().diagnostics.run(),
    getLast: (): Promise<DiagnosticsRunResult | null> => bridge().diagnostics.getLast(),
    logs: (): Promise<DiagnosticLogChunk[]> => bridge().diagnostics.logs(),
    repair: (actionId: DiagnosticRepairActionId): Promise<DiagnosticRepairResult> =>
      bridge().diagnostics.repair(actionId),
    exportReport: (): Promise<DiagnosticsReportResult> => bridge().diagnostics.exportReport(),
    openWindow: (): Promise<boolean> => bridge().diagnostics.openWindow(),
    ping: (): Promise<{ pong: boolean; at: string; mainWindow: boolean }> =>
      bridge().diagnostics.ping()
  }
}
