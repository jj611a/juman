import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type { ApiResult } from '../shared/api'
import type { ApiInvokeRequest } from '../shared/apiInvoke'
import type { SessionView } from '../shared/session'
import type { StartupStatus } from '../shared/startup'
import type { JumanPreloadApi } from '../shared/preload'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ApiResult<T>
  if (!result.ok) throw result.error
  return result.data
}

const juman: JumanPreloadApi = {
  auth: {
    getSession: () => invoke(IpcChannels.AUTH_GET_SESSION),
    login: (payload) => invoke(IpcChannels.AUTH_LOGIN, payload),
    logout: () => invoke(IpcChannels.AUTH_LOGOUT),
    changePassword: (payload) => invoke(IpcChannels.AUTH_CHANGE_PASSWORD, payload),
    onChanged: (listener) => {
      const handler = (_: Electron.IpcRendererEvent, session: SessionView): void => {
        listener(session)
      }
      ipcRenderer.on(IpcChannels.AUTH_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.AUTH_CHANGED, handler)
    }
  },
  api: {
    invoke: <T = unknown>(request: ApiInvokeRequest) =>
      invoke<T>(IpcChannels.API_INVOKE, request)
  },
  media: {
    upload: (file: { name: string; mimeType: string; buffer: ArrayBuffer }) =>
      invoke(IpcChannels.MEDIA_UPLOAD, file)
  },
  receipt: {
    print: (payload: { html: string; paperWidthMm?: number }) =>
      invoke(IpcChannels.RECEIPT_PRINT, payload)
  },
  reports: {
    export: (payload: { report: string; format: 'csv' | 'json'; query?: Record<string, unknown> }) =>
      invoke(IpcChannels.REPORTS_EXPORT, payload)
  },
  app: {
    getConfig: () => invoke(IpcChannels.APP_GET_CONFIG),
    quit: () => invoke(IpcChannels.APP_QUIT)
  },
  startup: {
    getStatus: () => invoke(IpcChannels.STARTUP_GET_STATUS),
    retry: () => invoke(IpcChannels.STARTUP_RETRY),
    onChanged: (listener) => {
      const handler = (_: Electron.IpcRendererEvent, status: StartupStatus): void => {
        listener(status)
      }
      ipcRenderer.on(IpcChannels.STARTUP_CHANGED, handler)
      return () => ipcRenderer.removeListener(IpcChannels.STARTUP_CHANGED, handler)
    }
  },
  window: {
    minimize: () => invoke(IpcChannels.WINDOW_MINIMIZE),
    maximize: () => invoke(IpcChannels.WINDOW_MAXIMIZE),
    close: () => invoke(IpcChannels.WINDOW_CLOSE)
  }
}

contextBridge.exposeInMainWorld('juman', juman)
