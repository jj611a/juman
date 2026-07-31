import { ipcMain, type BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/channels'
import type { ApiResult } from '../../shared/api'
import type {
  DiagnosticRepairActionId,
  DiagnosticsRunResult
} from '../../shared/diagnostics'
import { collectDiagnosticLogs, appendMainLog } from './logCollectors'
import { exportDiagnosticsReport } from './reportZip'
import { runRepairAction } from './repairs'
import { runAllDiagnostics } from './runner'
import { openOrFocusDiagnosticsWindow } from '../window'

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function fail(error: { code: string; message: string; details?: unknown }): ApiResult<never> {
  return { ok: false, error }
}

let lastRun: DiagnosticsRunResult | null = null

export function registerDiagnosticsIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.DIAGNOSTICS_RUN, async () => {
    try {
      appendMainLog('diagnostics: run started')
      lastRun = await runAllDiagnostics()
      appendMainLog(
        `diagnostics: run finished overall=${lastRun.summary.overallHealth} fails=${lastRun.summary.failCount}`
      )
      return ok(lastRun)
    } catch (err) {
      const error = err instanceof Error ? err.stack || err.message : String(err)
      appendMainLog(`diagnostics: run exception ${error}`)
      return fail({ code: 'DIAGNOSTICS_RUN_FAILED', message: error })
    }
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_GET_LAST, async () => {
    return ok(lastRun)
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_LOGS, async () => {
    try {
      return ok(collectDiagnosticLogs())
    } catch (err) {
      const error = err instanceof Error ? err.stack || err.message : String(err)
      return fail({ code: 'DIAGNOSTICS_LOGS_FAILED', message: error })
    }
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_REPAIR, async (_e, actionId: DiagnosticRepairActionId) => {
    try {
      appendMainLog(`diagnostics: repair ${actionId}`)
      const result = await runRepairAction(actionId)
      appendMainLog(`diagnostics: repair ${actionId} ok=${result.ok}`)
      return ok(result)
    } catch (err) {
      const error = err instanceof Error ? err.stack || err.message : String(err)
      return fail({ code: 'DIAGNOSTICS_REPAIR_FAILED', message: error })
    }
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_EXPORT_REPORT, async () => {
    try {
      const result = await exportDiagnosticsReport(lastRun)
      return ok(result)
    } catch (err) {
      const error = err instanceof Error ? err.stack || err.message : String(err)
      return fail({ code: 'DIAGNOSTICS_EXPORT_FAILED', message: error })
    }
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_OPEN_WINDOW, async () => {
    try {
      openOrFocusDiagnosticsWindow()
      return ok(true)
    } catch (err) {
      const error = err instanceof Error ? err.stack || err.message : String(err)
      return fail({ code: 'DIAGNOSTICS_OPEN_FAILED', message: error })
    }
  })

  ipcMain.handle(IpcChannels.DIAGNOSTICS_PING, async () => {
    return ok({ pong: true, at: new Date().toISOString(), mainWindow: Boolean(getMainWindow()) })
  })
}
