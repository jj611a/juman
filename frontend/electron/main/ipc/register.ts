import { ipcMain } from 'electron'
import type { AxiosInstance } from 'axios'
import { IpcChannels } from '../../shared/channels'
import type { ApiResult } from '../../shared/api'
import type { ApiInvokeRequest } from '../../shared/apiInvoke'
import type { SessionManager } from '../auth/sessionManager'
import type { createDesktopHandlers } from '../desktop/stubs'
import { executeApiInvoke } from './apiInvoke'

type Desktop = ReturnType<typeof createDesktopHandlers>

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(error: { code: string; message: string; details?: unknown }): ApiResult<never> {
  return { ok: false, error }
}

export function registerIpcHandlers(
  session: SessionManager,
  desktop: Desktop,
  http: AxiosInstance
): void {
  ipcMain.handle(IpcChannels.AUTH_GET_SESSION, async () => {
    return ok(session.getSessionView())
  })

  ipcMain.handle(
    IpcChannels.AUTH_LOGIN,
    async (_e, payload: { username: string; password: string; remember?: boolean }) => {
      try {
        return ok(
          await session.login(payload.username, payload.password, { remember: payload.remember })
        )
      } catch (error) {
        return fail(session.asAppError(error))
      }
    }
  )

  ipcMain.handle(
    IpcChannels.AUTH_CHANGE_PASSWORD,
    async (_e, payload: { currentPassword: string; newPassword: string }) => {
      try {
        return ok(await session.changePassword(payload.currentPassword, payload.newPassword))
      } catch (error) {
        return fail(session.asAppError(error))
      }
    }
  )

  ipcMain.handle(IpcChannels.AUTH_REFRESH, async () => {
    const refreshed = await session.refresh()
    return ok({ refreshed, session: session.getSessionView() })
  })

  ipcMain.handle(IpcChannels.AUTH_LOGOUT, async () => {
    return ok(await session.logout())
  })

  ipcMain.handle(IpcChannels.AUTH_LOGOUT_ALL, async () => {
    return ok(await session.logoutAll())
  })

  ipcMain.handle(IpcChannels.AUTH_IS_AUTHENTICATED, async () => {
    return ok(session.isAuthenticated())
  })

  ipcMain.handle(IpcChannels.SYSTEM_HEALTH, async () => {
    try {
      return ok(await session.systemHealth())
    } catch (error) {
      return fail(session.asAppError(error))
    }
  })

  ipcMain.handle(IpcChannels.SYSTEM_VERSION, async () => {
    try {
      return ok(await session.systemVersion())
    } catch (error) {
      return fail(session.asAppError(error))
    }
  })

  ipcMain.handle(IpcChannels.API_INVOKE, async (_e, request: ApiInvokeRequest) => {
    try {
      if (!request || typeof request.path !== 'string' || typeof request.method !== 'string') {
        return fail({ code: 'INVALID_REQUEST', message: 'طلب API غير صالح' })
      }
      return ok(await executeApiInvoke(http, request))
    } catch (error) {
      return fail(session.asAppError(error))
    }
  })

  ipcMain.handle(IpcChannels.APP_GET_CONFIG, async () => {
    return ok({
      locale: 'ar' as const,
      direction: 'rtl' as const,
      appName: 'Juman',
      appNameAr: 'جمان'
    })
  })

  ipcMain.handle(IpcChannels.DESKTOP_DIALOG_MESSAGE, async (_e, options) => {
    return ok(await desktop.messageBox(options))
  })

  ipcMain.handle(IpcChannels.DESKTOP_WINDOW_MINIMIZE, async () => {
    desktop.minimize()
    return ok(true)
  })

  ipcMain.handle(IpcChannels.DESKTOP_WINDOW_MAXIMIZE, async () => {
    desktop.maximize()
    return ok(true)
  })

  ipcMain.handle(IpcChannels.DESKTOP_WINDOW_CLOSE, async () => {
    desktop.close()
    return ok(true)
  })

  ipcMain.handle(IpcChannels.DESKTOP_WINDOW_IS_MAXIMIZED, async () => {
    return ok(desktop.isMaximized())
  })

  ipcMain.handle(IpcChannels.DESKTOP_WINDOW_SET_TITLE, async (_e, title: string) => {
    desktop.setTitle(typeof title === 'string' ? title : 'جمان')
    return ok(true)
  })

  ipcMain.handle(IpcChannels.DESKTOP_FS_STUB, async () => ok(desktop.fsStub()))
  ipcMain.handle(IpcChannels.DESKTOP_PRINT_STUB, async () => ok(desktop.printStub()))
  ipcMain.handle(IpcChannels.DESKTOP_BARCODE_STUB, async () => ok(desktop.barcodeStub()))
}
