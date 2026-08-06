import { BrowserWindow, screen } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { installRoot } from './serviceStatus'

export type InstallProgressState = {
  version?: number
  state: 'running' | 'ok' | 'error' | string
  phase: string
  percent: number
  message: string
  detail?: string
  bootstrapLog?: string
  progressLog?: string
  pipLog?: string
  migrateLog?: string
  elapsedSec?: number
  updatedAt?: string
}

export function installProgressJsonPath(root = installRoot()): string {
  return join(root, 'logs', 'install-progress.json')
}

export function readInstallProgress(root = installRoot()): InstallProgressState | null {
  const path = installProgressJsonPath(root)
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as InstallProgressState
  } catch {
    return null
  }
}

function progressHtml(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>تثبيت جمان</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; font-family: "Segoe UI", Tahoma, sans-serif;
    background: linear-gradient(160deg, #f4f7fb 0%, #e8eef6 55%, #f7f3ea 100%);
    color: #1a2332; min-height: 100vh;
  }
  .wrap { padding: 28px 32px 24px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; font-weight: 700; }
  .sub { color: #5b6b7c; font-size: 13px; margin-bottom: 22px; line-height: 1.5; }
  .bar {
    height: 14px; border-radius: 999px; background: #d7e0ea; overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,.08);
  }
  .fill {
    height: 100%; width: 0%; background: linear-gradient(90deg, #1f6feb, #2ea043);
    transition: width .35s ease;
  }
  .fill.err { background: linear-gradient(90deg, #cf222e, #a40e26); }
  .fill.ok { background: linear-gradient(90deg, #1a7f37, #2ea043); }
  .meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; color: #445; }
  .phase {
    margin-top: 18px; padding: 14px 16px; border-radius: 12px;
    background: rgba(255,255,255,.72); border: 1px solid rgba(26,35,50,.08);
  }
  .phase .label { font-size: 12px; color: #6a7a8c; margin-bottom: 4px; }
  .phase .msg { font-size: 15px; font-weight: 600; }
  .detail { margin-top: 8px; font-size: 12px; color: #4d5d6e; word-break: break-all; direction: ltr; text-align: left; }
  .logs { margin-top: 16px; font-size: 12px; color: #5b6b7c; line-height: 1.6; }
  .logs code { direction: ltr; display: inline-block; background: #eef2f7; padding: 1px 6px; border-radius: 4px; }
  .note { margin-top: 14px; font-size: 12px; color: #6a7a8c; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>تثبيت مكوّنات الخادم</h1>
    <p class="sub">الإطلاق الأول يحتاج إنترنت (PyPI) مرة واحدة: بيئة Python، الحزم، الترحيل، وخدمة Windows.</p>
    <div class="bar"><div id="fill" class="fill"></div></div>
    <div class="meta"><span id="pct">0%</span><span id="elapsed">0 ث</span></div>
    <div class="phase">
      <div class="label" id="phase">init</div>
      <div class="msg" id="msg">جاري التحضير…</div>
      <div class="detail" id="detail"></div>
    </div>
    <div class="logs">سجلات التثبيت:<br/>
      <code id="plog">logs\\install-progress.log</code><br/>
      <code id="blog">logs\\bootstrap-*.log</code>
    </div>
    <p class="note">وافق على طلب صلاحية المسؤول (UAC) إن ظهر. لا تغلق هذه النافذة حتى يكتمل التثبيت.</p>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    function apply(p) {
      if (!p) return;
      const fill = document.getElementById('fill');
      const pct = Math.max(0, Math.min(100, Number(p.percent) || 0));
      fill.style.width = pct + '%';
      fill.classList.toggle('err', p.state === 'error');
      fill.classList.toggle('ok', p.state === 'ok');
      document.getElementById('pct').textContent = pct + '%';
      document.getElementById('elapsed').textContent = (p.elapsedSec != null ? p.elapsedSec : 0) + ' ث';
      document.getElementById('phase').textContent = p.phase || '';
      document.getElementById('msg').textContent = p.message || '';
      document.getElementById('detail').textContent = p.detail || '';
      if (p.progressLog) document.getElementById('plog').textContent = p.progressLog;
      if (p.bootstrapLog) document.getElementById('blog').textContent = p.bootstrapLog;
    }
    ipcRenderer.on('install-progress', (_e, data) => apply(data));
  </script>
</body>
</html>`
}

let progressWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

export function showInstallProgressWindow(): BrowserWindow {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.focus()
    return progressWindow
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    width: Math.min(680, width - 40),
    height: Math.min(420, height - 40),
    resizable: false,
    maximizable: false,
    minimizable: true,
    autoHideMenuBar: true,
    title: 'Juman — تثبيت الخادم',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  win.setMenuBarVisibility(false)
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(progressHtml())}`)
  progressWindow = win
  win.on('closed', () => {
    progressWindow = null
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })
  return win
}

export function startInstallProgressPolling(root = installRoot()): void {
  const win = showInstallProgressWindow()
  const push = (): void => {
    if (!win || win.isDestroyed()) return
    const p = readInstallProgress(root)
    if (p) win.webContents.send('install-progress', p)
  }
  push()
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(push, 600)
}

export function stopInstallProgressPolling(final?: InstallProgressState | null): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (progressWindow && !progressWindow.isDestroyed()) {
    if (final) progressWindow.webContents.send('install-progress', final)
    // Keep window briefly on success/error so operator can read paths
    setTimeout(() => {
      if (progressWindow && !progressWindow.isDestroyed()) progressWindow.close()
    }, final?.state === 'error' ? 8000 : 2500)
  }
}

export function closeInstallProgressWindow(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (progressWindow && !progressWindow.isDestroyed()) progressWindow.close()
  progressWindow = null
}