import { app, BrowserWindow } from 'electron'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadMainConfig } from './config'
import { createHttpClient } from './http/client'
import { SafeStorageCredentialStore } from './security/credentialStore'
import { SessionManager } from './auth/sessionManager'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow, loadMainWindow } from './window'
import { StartupManager } from './startup/StartupManager'
import { IpcChannels } from '../shared/channels'
import {
  STARTUP_DEFAULT_TIMEOUT_MS,
  type StartupStatus,
} from '../shared/startup'

const DEBUG_LOG = join(tmpdir(), 'opencode', 'juman-renderer-debug.log')
let mainWindow: BrowserWindow | null = null

const config = loadMainConfig()
const http = createHttpClient(config.apiBaseUrl)

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : STARTUP_DEFAULT_TIMEOUT_MS
}

/** Broadcast sanitized startup state to every open window. */
function broadcastStartup(status: StartupStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.STARTUP_CHANGED, status)
  }
}

app.whenReady().then(async () => {
  mainWindow = createMainWindow()
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) {
      try { appendFileSync(DEBUG_LOG, `[console lvl=${level}] ${sourceId}:${line} ${message}\n`) } catch {}
    }
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    try { appendFileSync(DEBUG_LOG, `[render-gone] ${JSON.stringify(details)}\n`) } catch {}
  })
  mainWindow.webContents.on('preload-error', (_e, path, error) => {
    try { appendFileSync(DEBUG_LOG, `[preload-error] ${path} ${error}\n`) } catch {}
  })

  const credentials = new SafeStorageCredentialStore()
  const session = new SessionManager(http, credentials, () => mainWindow)

  const startup = new StartupManager({
    timeoutMs: parseTimeout(process.env.JUMAN_STARTUP_TIMEOUT_MS),
    probe: async () => {
      try {
        const res = await http.get('/health', { timeout: 4_000 })
        const data = res.data as { status?: string; database?: string } | undefined
        if (res.status < 400 && data?.status === 'ok' && data.database === 'connected') {
          return 'ok'
        }
        if (res.status < 400 && data && typeof data.status === 'string') {
          return 'degraded'
        }
        return 'foreign'
      } catch {
        return 'not_ready'
      }
    },
    onStateChange: broadcastStartup,
    onReady: () => session.bootstrap()
  })

  registerIpcHandlers(session, http, config, startup)

  // Splash mounts immediately; the app is unlocked only when READY is emitted
  // (which happens AFTER session.bootstrap() via StartupManager.onReady).
  await loadMainWindow(mainWindow)
  startup.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      void loadMainWindow(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
