import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type { ApiResult } from '../shared/api'
import type { ApiInvokeRequest } from '../shared/apiInvoke'
import type { SessionView } from '../shared/session'
import type { StubResult } from '../shared/desktop'
import type { AppRuntimeConfig } from '../shared/api'
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
} from '../shared/hardware'
import type {
  DiagnosticLogChunk,
  DiagnosticRepairActionId,
  DiagnosticRepairResult,
  DiagnosticsReportResult,
  DiagnosticsRunResult
} from '../shared/diagnostics'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ApiResult<T>
  if (!result.ok) {
    throw result.error
  }
  return result.data
}

const juman = {
  auth: {
    getSession: (): Promise<SessionView> => invoke(IpcChannels.AUTH_GET_SESSION),
    login: (payload: {
      username: string
      password: string
      remember?: boolean
    }): Promise<SessionView> => invoke(IpcChannels.AUTH_LOGIN, payload),
    changePassword: (payload: {
      currentPassword: string
      newPassword: string
    }): Promise<SessionView> => invoke(IpcChannels.AUTH_CHANGE_PASSWORD, payload),
    refresh: (): Promise<{ refreshed: boolean; session: SessionView }> =>
      invoke(IpcChannels.AUTH_REFRESH),
    logout: (): Promise<SessionView> => invoke(IpcChannels.AUTH_LOGOUT),
    logoutAll: (): Promise<SessionView> => invoke(IpcChannels.AUTH_LOGOUT_ALL),
    isAuthenticated: (): Promise<boolean> => invoke(IpcChannels.AUTH_IS_AUTHENTICATED),
    onChanged: (listener: (session: SessionView) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, session: SessionView): void => {
        listener(session)
      }
      ipcRenderer.on(IpcChannels.AUTH_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.AUTH_CHANGED, handler)
    }
  },
  api: {
    system: {
      health: (): Promise<unknown> => invoke(IpcChannels.SYSTEM_HEALTH),
      version: (): Promise<unknown> => invoke(IpcChannels.SYSTEM_VERSION)
    },
    invoke: <T = unknown>(request: ApiInvokeRequest): Promise<T> =>
      invoke(IpcChannels.API_INVOKE, request)
  },
  app: {
    getConfig: (): Promise<AppRuntimeConfig> => invoke(IpcChannels.APP_GET_CONFIG),
    getVersion: (): Promise<string> => invoke(IpcChannels.APP_GET_VERSION),
    getFirstRunState: (): Promise<FirstRunState> => invoke(IpcChannels.APP_FIRST_RUN_STATE),
    completeFirstRun: (): Promise<FirstRunState> => invoke(IpcChannels.APP_FIRST_RUN_COMPLETE),
    checkUpdates: (): Promise<UpdateCheckResult> => invoke(IpcChannels.APP_UPDATES_CHECK),
    readEnv: (): Promise<Record<string, string>> => invoke(IpcChannels.APP_READ_ENV),
    patchEnv: (updates: Record<string, string>): Promise<Record<string, string>> =>
      invoke(IpcChannels.APP_PATCH_ENV, updates)
  },
  desktop: {
    dialogs: {
      message: (options: {
        type?: 'none' | 'info' | 'error' | 'question' | 'warning'
        title?: string
        message: string
      }): Promise<{ response: number }> => invoke(IpcChannels.DESKTOP_DIALOG_MESSAGE, options)
    },
    window: {
      minimize: (): Promise<boolean> => invoke(IpcChannels.DESKTOP_WINDOW_MINIMIZE),
      maximize: (): Promise<boolean> => invoke(IpcChannels.DESKTOP_WINDOW_MAXIMIZE),
      close: (): Promise<boolean> => invoke(IpcChannels.DESKTOP_WINDOW_CLOSE),
      isMaximized: (): Promise<boolean> => invoke(IpcChannels.DESKTOP_WINDOW_IS_MAXIMIZED),
      setTitle: (title: string): Promise<boolean> => invoke(IpcChannels.DESKTOP_WINDOW_SET_TITLE, title)
    },
    fs: {
      stub: (): Promise<StubResult> => invoke(IpcChannels.DESKTOP_FS_STUB)
    }
  },
  hardware: {
    getConfig: (): Promise<HardwareStationConfig> => invoke(IpcChannels.HARDWARE_GET_CONFIG),
    setConfig: (patch: Partial<HardwareStationConfig>): Promise<HardwareStationConfig> =>
      invoke(IpcChannels.HARDWARE_SET_CONFIG, patch),
    listPrinters: (): Promise<PrinterInfo[]> => invoke(IpcChannels.HARDWARE_PRINTERS_LIST),
    probePrinter: (): Promise<PrinterProbeResult> => invoke(IpcChannels.HARDWARE_PRINTER_PROBE),
    diagnostics: (): Promise<HardwareDiagnosticsSnapshot> =>
      invoke(IpcChannels.HARDWARE_DIAGNOSTICS),
    testReceipt: (): Promise<PrintStatus> => invoke(IpcChannels.HARDWARE_RECEIPT_TEST),
    previewLabel: (payload: { barcode: string; title?: string | null }): Promise<LabelPreview> =>
      invoke(IpcChannels.HARDWARE_LABEL_PREVIEW, payload),
    printLabel: (payload: { barcode: string; title?: string | null }): Promise<PrintStatus> =>
      invoke(IpcChannels.HARDWARE_LABEL_PRINT, payload),
    openDrawer: (): Promise<PrintStatus> => invoke(IpcChannels.HARDWARE_DRAWER_OPEN),
    cameraCapabilities: (): Promise<CameraCapabilities> =>
      invoke(IpcChannels.HARDWARE_CAMERA_CAPABILITIES),
    backendStatus: (): Promise<BackendServiceStatus> => invoke(IpcChannels.HARDWARE_BACKEND_STATUS),
    startBackend: (): Promise<BackendServiceStatus> => invoke(IpcChannels.HARDWARE_BACKEND_START),
    stopBackend: (): Promise<BackendServiceStatus> => invoke(IpcChannels.HARDWARE_BACKEND_STOP),
    restartBackend: (): Promise<BackendServiceStatus> =>
      invoke(IpcChannels.HARDWARE_BACKEND_RESTART),
    repairBackend: (): Promise<BackendServiceStatus> => invoke(IpcChannels.HARDWARE_BACKEND_REPAIR),
    openLogs: (): Promise<boolean> => invoke(IpcChannels.HARDWARE_OPEN_LOGS),
    onScan: (listener: (event: ScanEvent) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, scan: ScanEvent): void => {
        listener(scan)
      }
      ipcRenderer.on(IpcChannels.HARDWARE_SCAN_EVENT, handler)
      return () => ipcRenderer.removeListener(IpcChannels.HARDWARE_SCAN_EVENT, handler)
    }
  },
  diagnostics: {
    run: (): Promise<DiagnosticsRunResult> => invoke(IpcChannels.DIAGNOSTICS_RUN),
    getLast: (): Promise<DiagnosticsRunResult | null> => invoke(IpcChannels.DIAGNOSTICS_GET_LAST),
    logs: (): Promise<DiagnosticLogChunk[]> => invoke(IpcChannels.DIAGNOSTICS_LOGS),
    repair: (actionId: DiagnosticRepairActionId): Promise<DiagnosticRepairResult> =>
      invoke(IpcChannels.DIAGNOSTICS_REPAIR, actionId),
    exportReport: (): Promise<DiagnosticsReportResult> =>
      invoke(IpcChannels.DIAGNOSTICS_EXPORT_REPORT),
    openWindow: (): Promise<boolean> => invoke(IpcChannels.DIAGNOSTICS_OPEN_WINDOW),
    ping: (): Promise<{ pong: boolean; at: string; mainWindow: boolean }> =>
      invoke(IpcChannels.DIAGNOSTICS_PING)
  }
}

export type JumanBridge = typeof juman

contextBridge.exposeInMainWorld('juman', juman)
