import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/channels'
import type { ApiResult } from '../shared/api'
import type { ApiInvokeRequest } from '../shared/apiInvoke'
import type { SessionView } from '../shared/session'
import type { StubResult } from '../shared/desktop'
import type { AppRuntimeConfig } from '../shared/api'

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
    getConfig: (): Promise<AppRuntimeConfig> => invoke(IpcChannels.APP_GET_CONFIG)
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
    },
    print: {
      stub: (): Promise<StubResult> => invoke(IpcChannels.DESKTOP_PRINT_STUB)
    },
    barcode: {
      stub: (): Promise<StubResult> => invoke(IpcChannels.DESKTOP_BARCODE_STUB)
    }
  }
}

export type JumanBridge = typeof juman

contextBridge.exposeInMainWorld('juman', juman)
