import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import type { AxiosInstance } from 'axios'
import { writeFile } from 'node:fs/promises'
import { IpcChannels } from '../../shared/channels'
import type { ApiResult } from '../../shared/api'
import type { ApiInvokeRequest } from '../../shared/apiInvoke'
import type { SessionManager } from '../auth/sessionManager'
import type { StartupManager } from '../startup/StartupManager'
import type { MainConfig } from '../config'

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(code: string, message: string, details?: unknown): ApiResult<never> {
  return { ok: false, error: { code, message, details } }
}

export function registerIpcHandlers(
  session: SessionManager,
  http: AxiosInstance,
  config: MainConfig,
  startup?: StartupManager
): void {
  ipcMain.handle(IpcChannels.AUTH_GET_SESSION, () => ok(session.view()))

  ipcMain.handle(
    IpcChannels.AUTH_LOGIN,
    async (_e, payload: { username: string; password: string; remember?: boolean }) => {
      try {
        return ok(await session.login(payload.username, payload.password, payload.remember))
      } catch (err) {
        const e = err as { code?: string; message?: string; data?: unknown }
        return fail(e.code ?? 'AUTH_FAILED', e.message ?? 'Login failed', e.data)
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

  ipcMain.handle(
    IpcChannels.API_INVOKE,
    async (_e, request: ApiInvokeRequest) => {
      try {
        const send = (token: string | null) =>
          http.request({
            method: request.method,
            url: request.path,
            params: request.query,
            data: request.body,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })

        let token = session.getAccessToken()
        let res = await send(token)

        if (res.status === 401 && token && (await session.refreshAccessToken())) {
          token = session.getAccessToken()
          res = await send(token)
        }

        if (res.status === 401) {
          await session.terminate()
        }

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

  ipcMain.handle(IpcChannels.APP_QUIT, () => {
    app.quit()
    return ok(undefined)
  })

  if (startup) {
    ipcMain.handle(IpcChannels.STARTUP_GET_STATUS, () => ok(startup.getStatus()))
    ipcMain.handle(IpcChannels.STARTUP_RETRY, () => {
      startup.retry()
      return ok(undefined)
    })
  }

  ipcMain.handle(
    IpcChannels.MEDIA_UPLOAD,
    async (
      _e,
      file: { name: string; mimeType: string; buffer: ArrayBuffer }
    ) => {
      try {
        const form = new FormData()
        const blob = new Blob([file.buffer], { type: file.mimeType })
        form.append('file', blob, file.name)

        let token = session.getAccessToken()

        const send = async (useToken: string | null) =>
          http.request({
            method: 'POST',
            url: '/media',
            data: form,
            headers: useToken ? { Authorization: `Bearer ${useToken}` } : undefined
          })

        let res = await send(token)

        if (res.status === 401 && token && (await session.refreshAccessToken())) {
          token = session.getAccessToken()
          res = await send(token)
        }

        if (res.status === 401) {
          await session.terminate()
        }

        if (res.status >= 400) {
          const body = res.data as { message?: string; error?: { message?: string; code?: string } }
          return fail(
            body.error?.code ?? `HTTP_${res.status}`,
            body.error?.message ?? body.message ?? `Upload failed (${res.status})`
          )
        }
        return ok(res.data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        return fail('NETWORK', message)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.RECEIPT_PRINT,
    async (
      _e,
      payload: { html: string; paperWidthMm?: number }
    ): Promise<ApiResult<{ success: boolean; cancelled?: boolean }>> => {
      if (!payload?.html || typeof payload.html !== 'string' || payload.html.length > 2_000_000) {
        return fail('INVALID_PAYLOAD', 'Invalid receipt payload')
      }
      try {
        const printWin = new BrowserWindow({
          width: Math.max(400, Math.min(1200, (payload.paperWidthMm ?? 80) * 8)),
          height: 1400,
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        })

        const url =
          'data:text/html;charset=utf-8;base64,' +
          Buffer.from(payload.html, 'utf-8').toString('base64')
        await printWin.loadURL(url)

        const result = await new Promise<{ success: boolean; cancelled?: boolean }>((resolve) => {
          printWin.webContents.print(
            { silent: false, printBackground: true },
            (success, failureReason) => {
              if (success) resolve({ success: true })
              else if (
                typeof failureReason === 'string' &&
                failureReason.toLowerCase().includes('cancel')
              ) {
                resolve({ success: false, cancelled: true })
              } else {
                resolve({ success: false })
              }
            }
          )
        })

        if (!printWin.isDestroyed()) printWin.destroy()
        return ok(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Print failed'
        return fail('PRINT_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    IpcChannels.REPORTS_EXPORT,
    async (
      e,
      payload: {
        report: string
        format: 'csv' | 'json'
        query?: Record<string, unknown>
      }
    ): Promise<ApiResult<{ saved: boolean; path?: string; cancelled?: boolean }>> => {
      if (!payload || (payload.format !== 'csv' && payload.format !== 'json')) {
        return fail('INVALID_PAYLOAD', 'PDF/Excel export adapters are not implemented in the backend')
      }

      const win = BrowserWindow.fromWebContents(e.sender)
      const saveResult = await dialog.showSaveDialog(win!, {
        title: 'تصدير التقرير',
        defaultPath: `${payload.report}.${payload.format}`,
        filters:
          payload.format === 'csv'
            ? [{ name: 'CSV', extensions: ['csv'] }]
            : [{ name: 'JSON', extensions: ['json'] }],
      })
      if (saveResult.canceled || !saveResult.filePath) {
        return ok({ saved: false, cancelled: true })
      }

      try {
        let token = session.getAccessToken()
        const send = (useToken: string | null) =>
          http.request({
            method: 'GET',
            url: '/reports/export',
            params: { format: payload.format, report: payload.report, ...payload.query },
            headers: useToken ? { Authorization: `Bearer ${useToken}` } : undefined,
            responseType: 'arraybuffer',
          })

        let res = await send(token)
        if (res.status === 401 && token && (await session.refreshAccessToken())) {
          token = session.getAccessToken()
          res = await send(token)
        }
        if (res.status === 401) {
          await session.terminate()
        }
        if (res.status >= 400) {
          return fail(`HTTP_${res.status}`, `Export failed (${res.status})`)
        }

        await writeFile(saveResult.filePath, Buffer.from(res.data as ArrayBuffer))
        return ok({ saved: true, path: saveResult.filePath })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed'
        return fail('EXPORT_FAILED', message)
      }
    }
  )
}
