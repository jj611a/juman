import { app, BrowserWindow } from 'electron'
import { loadMainConfig } from './config'
import { createHttpClient } from './http/client'
import { SafeStorageCredentialStore } from './security/credentialStore'
import { SessionManager } from './auth/sessionManager'
import { createDesktopHandlers } from './desktop/stubs'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow, loadMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

const config = loadMainConfig()
const http = createHttpClient(config.apiBaseUrl)

app.whenReady().then(async () => {
  mainWindow = createMainWindow()

  const credentials = new SafeStorageCredentialStore()
  const session = new SessionManager(http.getInstance(), credentials, () => mainWindow)
  const desktop = createDesktopHandlers(() => mainWindow)

  registerIpcHandlers(session, desktop, http.getInstance())

  await session.bootstrap()
  await loadMainWindow(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      void loadMainWindow(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})
