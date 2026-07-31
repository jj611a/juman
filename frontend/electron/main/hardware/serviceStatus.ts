import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { BackendServiceStatus } from '../../shared/hardware'

const execFileAsync = promisify(execFile)

export const JUMAN_API_SERVICE_NAME = 'JumanApi'

let portableApiChild: ChildProcess | null = null

function packagedAppDir(): string {
  return dirname(app.getPath('exe'))
}

/** True when running from a portable folder (marker / env), not Program Files install. */
export function isPortableInstall(): boolean {
  if (process.env.JUMAN_PORTABLE === '1' || process.env.JUMAN_PORTABLE === 'true') return true
  const fromEnv = process.env.JUMAN_INSTALL_DIR?.trim()
  if (fromEnv) {
    return existsSync(join(fromEnv, 'portable.marker'))
  }
  try {
    return existsSync(join(packagedAppDir(), 'portable.marker'))
  } catch {
    return false
  }
}

export function installRoot(): string {
  if (process.env.JUMAN_INSTALL_DIR) return process.env.JUMAN_INSTALL_DIR
  try {
    const appDir = packagedAppDir()
    if (
      existsSync(join(appDir, 'portable.marker')) ||
      existsSync(join(appDir, 'config', 'juman.env'))
    ) {
      // Prefer folder beside Juman.exe when portable layout / local config is present.
      if (
        existsSync(join(appDir, 'backend', 'juman-api.exe')) ||
        existsSync(join(appDir, 'portable.marker'))
      ) {
        return appDir
      }
    }
  } catch {
    /* fall through */
  }
  if (process.platform === 'win32') {
    return join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Juman')
  }
  return join(app.getPath('userData'), 'install')
}

export function apiExePath(): string {
  return join(installRoot(), 'backend', 'juman-api.exe')
}

export function installLogsHint(): string {
  return join(installRoot(), 'logs')
}

export function jumanEnvPath(): string {
  return join(installRoot(), 'config', 'juman.env')
}

export function readJumanEnv(): Record<string, string> {
  const path = jumanEnvPath()
  const out: Record<string, string> = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const raw = line.trim()
    if (!raw || raw.startsWith('#') || !raw.includes('=')) continue
    const i = raw.indexOf('=')
    out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim()
  }
  return out
}

export function patchJumanEnv(updates: Record<string, string>): Record<string, string> {
  const path = jumanEnvPath()
  const current = readJumanEnv()
  const next = { ...current, ...updates }
  const dir = join(installRoot(), 'config')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const body = Object.entries(next)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  writeFileSync(path, `${body}\n`, 'utf8')
  return next
}

function winswPath(): string {
  return join(installRoot(), 'backend', 'JumanApi.exe')
}

async function probeApiHealth(): Promise<boolean> {
  try {
    const base = (process.env.JUMAN_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(
      /\/$/,
      ''
    )
    const url = `${base}/health`
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) })
    return res.ok || (res.status >= 200 && res.status < 500)
  } catch {
    return false
  }
}

export async function getBackendServiceStatus(): Promise<BackendServiceStatus> {
  const logsHint = installLogsHint()
  if (process.platform !== 'win32') {
    return {
      platform: process.platform,
      serviceName: JUMAN_API_SERVICE_NAME,
      state: 'unsupported',
      raw: 'Windows services are only managed on win32',
      canStart: false,
      logsHint
    }
  }

  if (isPortableInstall()) {
    const healthy = await probeApiHealth()
    const childAlive = Boolean(
      portableApiChild && !portableApiChild.killed && portableApiChild.exitCode == null
    )
    const running = healthy || childAlive
    return {
      platform: 'win32',
      serviceName: 'juman-api.exe (portable)',
      state: running ? 'running' : 'stopped',
      raw: running
        ? `portable API ${healthy ? 'healthy' : 'starting'}; child=${childAlive}`
        : 'portable API not running (use Start Juman Portable.cmd or Start Backend)',
      canStart: !running,
      logsHint
    }
  }

  try {
    const { stdout } = await execFileAsync('sc.exe', ['query', JUMAN_API_SERVICE_NAME], {
      windowsHide: true
    })
    const raw = stdout.toString()
    const running = /STATE\s*:\s*\d+\s+RUNNING/i.test(raw)
    const stopped = /STATE\s*:\s*\d+\s+STOPPED/i.test(raw)
    return {
      platform: 'win32',
      serviceName: JUMAN_API_SERVICE_NAME,
      state: running ? 'running' : stopped ? 'stopped' : 'unknown',
      raw,
      canStart: !running,
      logsHint
    }
  } catch (error) {
    return {
      platform: 'win32',
      serviceName: JUMAN_API_SERVICE_NAME,
      state: 'unknown',
      raw: error instanceof Error ? error.message : String(error),
      canStart: true,
      logsHint
    }
  }
}

async function winsw(cmd: string): Promise<void> {
  const exe = winswPath()
  if (!existsSync(exe)) {
    throw new Error(`WinSW wrapper missing: ${exe}`)
  }
  await execFileAsync(exe, [cmd], { windowsHide: true })
}

/** Launch an elevated PowerShell script (UAC). Returns after process exits. */
async function runElevatedPowerShell(scriptPath: string, args: string[]): Promise<void> {
  if (!existsSync(scriptPath)) {
    throw new Error(`Script missing: ${scriptPath}`)
  }
  const argList = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args]
    .map((a) => `'${a.replace(/'/g, "''")}'`)
    .join(',')
  const ps = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(${argList})`
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { windowsHide: true }
  )
}

function spawnPortableApi(): void {
  const exe = apiExePath()
  if (!existsSync(exe)) {
    throw new Error(`juman-api.exe missing: ${exe}`)
  }
  if (portableApiChild && !portableApiChild.killed && portableApiChild.exitCode == null) {
    return
  }
  ensureInstallDirs(installRoot())
  const child = spawn(exe, [], {
    cwd: dirname(exe),
    windowsHide: true,
    env: {
      ...process.env,
      JUMAN_INSTALL_DIR: installRoot(),
      JUMAN_PORTABLE: '1'
    },
    stdio: 'ignore'
  })
  portableApiChild = child
  child.on('exit', () => {
    if (portableApiChild === child) portableApiChild = null
  })
}

/** Start console juman-api.exe when running portable (no WinSW). */
export async function ensurePortableApiRunning(): Promise<boolean> {
  if (!isPortableInstall()) return false
  if (await probeApiHealth()) return true
  spawnPortableApi()
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await probeApiHealth()) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

export function stopPortableApiChild(): void {
  if (portableApiChild && !portableApiChild.killed) {
    try {
      portableApiChild.kill()
    } catch {
      /* ignore */
    }
  }
  portableApiChild = null
}

export async function startBackendService(): Promise<BackendServiceStatus> {
  if (process.platform !== 'win32') return getBackendServiceStatus()
  if (isPortableInstall()) {
    try {
      spawnPortableApi()
    } catch {
      /* status below */
    }
    await new Promise((r) => setTimeout(r, 1500))
    return getBackendServiceStatus()
  }
  const elevated = join(installRoot(), 'scripts', 'start-services-elevated.ps1')
  try {
    // Prefer elevated start so non-admin Electron can recover after install.
    await runElevatedPowerShell(elevated, ['-InstallDir', installRoot()])
  } catch {
    try {
      await execFileAsync('sc.exe', ['start', 'postgresql-x64-16'], { windowsHide: true })
    } catch {
      /* ignore */
    }
    try {
      await execFileAsync('sc.exe', ['start', JUMAN_API_SERVICE_NAME], { windowsHide: true })
    } catch {
      try {
        await winsw('start')
      } catch {
        /* ignore */
      }
    }
  }
  return getBackendServiceStatus()
}

export async function stopBackendService(): Promise<BackendServiceStatus> {
  if (process.platform !== 'win32') return getBackendServiceStatus()
  if (isPortableInstall()) {
    stopPortableApiChild()
    return getBackendServiceStatus()
  }
  try {
    await winsw('stop')
  } catch {
    try {
      await execFileAsync('sc.exe', ['stop', JUMAN_API_SERVICE_NAME], { windowsHide: true })
    } catch {
      /* ignore */
    }
  }
  return getBackendServiceStatus()
}

export async function restartBackendService(): Promise<BackendServiceStatus> {
  await stopBackendService()
  await new Promise((r) => setTimeout(r, 1500))
  return startBackendService()
}

export async function repairBackendService(): Promise<BackendServiceStatus> {
  if (process.platform !== 'win32') return getBackendServiceStatus()
  if (isPortableInstall()) {
    stopPortableApiChild()
    await new Promise((r) => setTimeout(r, 500))
    spawnPortableApi()
    await new Promise((r) => setTimeout(r, 1500))
    return getBackendServiceStatus()
  }
  const repair = join(installRoot(), 'scripts', 'repair-install.ps1')
  try {
    await runElevatedPowerShell(repair, ['-InstallDir', installRoot()])
    return getBackendServiceStatus()
  } catch {
    /* fall through to in-process repair */
  }
  try {
    await winsw('stop')
  } catch {
    /* ignore */
  }
  try {
    await winsw('uninstall')
  } catch {
    /* ignore */
  }
  await winsw('install')
  await winsw('start')
  return getBackendServiceStatus()
}

export function ensureInstallDirs(root: string): void {
  for (const name of ['config', 'data', 'logs', 'storage', 'runtime']) {
    const p = join(root, name)
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
}

export function firstRunFlagPath(): string {
  return join(app.getPath('userData'), 'firstrun.done')
}
