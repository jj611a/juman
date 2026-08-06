import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type { ApiResult } from '../shared/api'
import type { ApiInvokeRequest } from '../shared/apiInvoke'
import type { SessionView } from '../shared/session'
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
  app: {
    getConfig: () => invoke(IpcChannels.APP_GET_CONFIG)
  },
  window: {
    minimize: () => invoke(IpcChannels.WINDOW_MINIMIZE),
    maximize: () => invoke(IpcChannels.WINDOW_MAXIMIZE),
    close: () => invoke(IpcChannels.WINDOW_CLOSE)
  }
}

contextBridge.exposeInMainWorld('juman', juman)
