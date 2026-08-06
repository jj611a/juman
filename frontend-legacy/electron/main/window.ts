import { BrowserWindow, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(__dirname, '../../public/brand/juman-logo.png'),
    join(__dirname, '../renderer/brand/juman-logo.png'),
    join(process.cwd(), 'public/brand/juman-logo.png')
  ]
  return candidates.find((p) => existsSync(p))
}

function basePrefs() {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  } as const
}

function attachSecurity(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
    }
  })
}

export function createMainWindow(): BrowserWindow {
  const icon = resolveAppIcon()
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'جمان',
    backgroundColor: '#0a0a0b',
    ...(icon ? { icon } : {}),
    webPreferences: { ...basePrefs() }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  attachSecurity(win)
  return win
}

export async function loadMainWindow(win: BrowserWindow): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let diagnosticsWindow: BrowserWindow | null = null

export function createDiagnosticsWindow(): BrowserWindow {
  if (diagnosticsWindow && !diagnosticsWindow.isDestroyed()) {
    return diagnosticsWindow
  }
  const icon = resolveAppIcon()
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'جمان — مركز التشخيص والاستعادة',
    backgroundColor: '#0a0a0b',
    ...(icon ? { icon } : {}),
    webPreferences: { ...basePrefs() }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    diagnosticsWindow = null
  })

  attachSecurity(win)
  diagnosticsWindow = win
  return win
}

export async function loadDiagnosticsWindow(win: BrowserWindow): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    await win.loadURL(`${base}#/diagnostics`)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/diagnostics'
    })
  }
}

export function openOrFocusDiagnosticsWindow(): BrowserWindow {
  const win = createDiagnosticsWindow()
  void loadDiagnosticsWindow(win)
  if (win.isMinimized()) win.restore()
  win.focus()
  return win
}

export function getDiagnosticsWindow(): BrowserWindow | null {
  return diagnosticsWindow && !diagnosticsWindow.isDestroyed() ? diagnosticsWindow : null
}
