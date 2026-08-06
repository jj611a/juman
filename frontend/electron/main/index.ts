import { app, BrowserWindow } from 'electron'
import { loadMainConfig } from './config'
import { createHttpClient } from './http/client'
import { SafeStorageCredentialStore } from './security/credentialStore'
import { SessionManager } from './auth/sessionManager'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow, loadMainWindow } from './window'

let mainWindow: BrowserWindow | null = null

const config = loadMainConfig()
const http = createHttpClient(config.apiBaseUrl)

app.whenReady().then(async () => {
  mainWindow = createMainWindow()
  const credentials = new SafeStorageCredentialStore()
  const session = new SessionManager(http, credentials, () => mainWindow)
  registerIpcHandlers(session, http, config)
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
  if (process.platform !== 'darwin') app.quit()
})
