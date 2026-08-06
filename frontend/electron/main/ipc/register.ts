import { BrowserWindow, ipcMain } from 'electron'
import type { AxiosInstance } from 'axios'
import { IpcChannels } from '../../shared/channels'
import type { ApiResult } from '../../shared/api'
import type { ApiInvokeRequest } from '../../shared/apiInvoke'
import type { SessionManager } from '../auth/sessionManager'
import type { MainConfig } from '../config'

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(code: string, message: string): ApiResult<never> {
  return { ok: false, error: { code, message } }
}

export function registerIpcHandlers(
  session: SessionManager,
  http: AxiosInstance,
  config: MainConfig
): void {
  ipcMain.handle(IpcChannels.AUTH_GET_SESSION, () => ok(session.view()))

  ipcMain.handle(
    IpcChannels.AUTH_LOGIN,
    async (_e, payload: { username: string; password: string }) => {
      try {
        return ok(await session.login(payload.username, payload.password))
      } catch (err) {
        const e = err as { code?: string; message?: string }
        return fail(e.code ?? 'AUTH_FAILED', e.message ?? 'Login failed')
      }
    }
  )

  ipcMain.handle(IpcChannels.AUTH_LOGOUT, async () => ok(await session.logout()))

  ipcMain.handle(
    IpcChannels.AUTH_CHANGE_PASSWORD,
    async (_e, payload: { currentPassword: string; newPassword: string }) => {
      try {
        await session.changePassword(payload.currentPassword, payload.newPassword)
        return ok(undefined)
      } catch (err) {
        const e = err as { code?: string; message?: string }
        return fail(e.code ?? 'PASSWORD_CHANGE_FAILED', e.message ?? 'Password change failed')
      }
    }
  )

  ipcMain.handle(IpcChannels.APP_GET_CONFIG, () =>
    ok({ apiBaseUrl: config.apiBaseUrl })
  )

  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
    return ok(undefined)
  })
  ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return ok(undefined)
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return ok(undefined)
  })
  ipcMain.handle(IpcChannels.WINDOW_CLOSE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
    return ok(undefined)
  })

  ipcMain.handle(IpcChannels.API_INVOKE, async (_e, request: ApiInvokeRequest) => {
    try {
      const token = session.getAccessToken()
      const res = await http.request({
        method: request.method,
        url: request.path,
        params: request.query,
        data: request.body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (res.status >= 400) {
        const body = res.data as { message?: string; error?: { message?: string; code?: string } }
        return fail(
          body.error?.code ?? `HTTP_${res.status}`,
          body.error?.message ?? body.message ?? `Request failed (${res.status})`
        )
      }
      return ok(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      return fail('NETWORK', message)
    }
  })
}
