import { app, BrowserWindow } from 'electron'
import { loadMainConfig } from './config'
import { createHttpClient } from './http/client'
import { SafeStorageCredentialStore } from './security/credentialStore'
import { SessionManager } from './auth/sessionManager'
import { createDesktopHandlers } from './desktop/stubs'
import { createHardwareController, registerHardwareIpc } from './hardware/register'
import { registerIpcHandlers } from './ipc/register'
import { registerDiagnosticsIpc } from './diagnostics/register'
import { appendMainLog } from './diagnostics/logCollectors'
import { installApplicationMenu, wantsDiagnosticsOnly } from './menu'
import {
  createMainWindow,
  createDiagnosticsWindow,
  loadMainWindow,
  loadDiagnosticsWindow
} from './window'

let mainWindow: BrowserWindow | null = null

const diagnosticsOnly = wantsDiagnosticsOnly()
const config = loadMainConfig()
const http = createHttpClient(config.apiBaseUrl)

app.whenReady().then(async () => {
  appendMainLog(`app ready diagnosticsOnly=${diagnosticsOnly}`)

  installApplicationMenu(() => mainWindow)
  registerDiagnosticsIpc(() => mainWindow)

  if (diagnosticsOnly) {
    const diag = createDiagnosticsWindow()
    const credentials = new SafeStorageCredentialStore()
    const session = new SessionManager(http.getInstance(), credentials, () => diag)
    const desktop = createDesktopHandlers(() => diag)
    const hardware = createHardwareController(() => diag)
    hardware.attachToWindow(diag)
    registerIpcHandlers(session, desktop, http.getInstance())
    registerHardwareIpc(hardware)
    await session.bootstrap()
    await loadDiagnosticsWindow(diag)
    return
  }

  mainWindow = createMainWindow()

  const credentials = new SafeStorageCredentialStore()
  const session = new SessionManager(http.getInstance(), credentials, () => mainWindow)
  const desktop = createDesktopHandlers(() => mainWindow)
  const hardware = createHardwareController(() => mainWindow)
  hardware.attachToWindow(mainWindow)

  registerIpcHandlers(session, desktop, http.getInstance())
  registerHardwareIpc(hardware)

  await session.bootstrap()
  await loadMainWindow(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      hardware.attachToWindow(mainWindow)
      void loadMainWindow(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (err) => {
  appendMainLog(`uncaughtException ${err.stack || err.message}`)
})

process.on('unhandledRejection', (reason) => {
  appendMainLog(`unhandledRejection ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`)
})
