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
        existsSync(join(appDir, 'backend', 'run_api.py')) ||
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

export function apiPythonPath(): string {
  return join(installRoot(), 'backend', '.venv', 'Scripts', 'python.exe')
}

export function runApiScriptPath(): string {
  return join(installRoot(), 'backend', 'run_api.py')
}

export function bootstrapMarkerPath(): string {
  return join(installRoot(), 'config', 'backend.bootstrap.ok')
}

export function embedPythonPath(): string {
  return join(installRoot(), 'runtime', 'python', 'python.exe')
}

/** Prefer venv python; fall back to frozen juman-api.exe (portable legacy). */
export function apiExePath(): string {
  const py = apiPythonPath()
  if (existsSync(py)) return py
  return join(installRoot(), 'backend', 'juman-api.exe')
}

export function needsBackendBootstrap(): boolean {
  if (process.platform !== 'win32') return false
  if (isPortableInstall()) {
    if (!existsSync(runApiScriptPath()) || !existsSync(embedPythonPath())) return false
  }
  if (!existsSync(runApiScriptPath())) return false
  if (!existsSync(embedPythonPath())) return false
  if (!existsSync(jumanEnvPath())) return false
  if (!existsSync(apiPythonPath())) return true
  if (!existsSync(bootstrapMarkerPath())) return true
  try {
    const marker = readFileSync(bootstrapMarkerPath(), 'utf8')
    const m = marker.match(/^requirements_sha256=(.+)$/m)
    const hashFile = join(installRoot(), 'backend', 'requirements.sha256')
    if (m && existsSync(hashFile)) {
      const want = readFileSync(hashFile, 'utf8').trim().toLowerCase()
      if (m[1].trim().toLowerCase() !== want) return true
    }
  } catch {
    return true
  }
  return false
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
  const py = apiPythonPath()
  const script = runApiScriptPath()
  const frozen = join(installRoot(), 'backend', 'juman-api.exe')
  const useVenv = existsSync(py) && existsSync(script)
  if (!useVenv && !existsSync(frozen)) {
    throw new Error(`backend runtime missing (venv or juman-api.exe) under ${installRoot()}`)
  }
  if (portableApiChild && !portableApiChild.killed && portableApiChild.exitCode == null) {
    return
  }
  ensureInstallDirs(installRoot())
  const child = useVenv
    ? spawn(py, [script], {
        cwd: join(installRoot(), 'backend'),
        windowsHide: true,
        env: {
          ...process.env,
          JUMAN_INSTALL_DIR: installRoot(),
          JUMAN_PORTABLE: '1'
        },
        stdio: 'ignore'
      })
    : spawn(frozen, [], {
        cwd: dirname(frozen),
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

export async function ensureBackendBootstrapped(): Promise<{ ok: boolean; message: string }> {
  if (process.platform !== 'win32') {
    return { ok: true, message: 'bootstrap not required' }
  }
  if (!needsBackendBootstrap()) {
    return { ok: true, message: 'bootstrap already current' }
  }
  const script = join(installRoot(), 'scripts', 'bootstrap-backend-venv.ps1')
  if (!existsSync(script)) {
    return { ok: false, message: `bootstrap script missing: ${script}` }
  }
  const progressPath = join(installRoot(), 'logs', 'install-progress.json')
  const progressLog = join(installRoot(), 'logs', 'INSTALL_PROGRESS.md')
  try {
    await runElevatedPowerShell(script, ['-InstallDir', installRoot()])
  } catch (err) {
    let progressHint = ''
    try {
      if (existsSync(progressPath)) {
        progressHint = ` | progress=${readFileSync(progressPath, 'utf8').trim()}`
      } else if (existsSync(progressLog)) {
        const lines = readFileSync(progressLog, 'utf8').trim().split(/\r?\n/)
        progressHint = ` | last=${lines[lines.length - 1] || ''}`
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      message: `${err instanceof Error ? err.message : String(err)}${progressHint}`
    }
  }
  if (needsBackendBootstrap()) {
    let hint = 'check logs/bootstrap-*.log and logs/INSTALL_PROGRESS.md; PyPI network required'
    try {
      if (existsSync(progressPath)) hint = readFileSync(progressPath, 'utf8').trim()
    } catch {
      /* ignore */
    }
    return { ok: false, message: `bootstrap did not complete (${hint})` }
  }
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (await probeApiHealth()) return { ok: true, message: 'bootstrap ok; health ready' }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return { ok: false, message: 'bootstrap finished but health not ready within 120s' }
}

export async function startBackendService(): Promise<BackendServiceStatus> {
  if (process.platform !== 'win32') return getBackendServiceStatus()
  if (isPortableInstall()) {
    if (needsBackendBootstrap()) {
      await ensureBackendBootstrapped()
    } else {
      try {
        spawnPortableApi()
      } catch {
        /* status below */
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
    return getBackendServiceStatus()
  }
  if (needsBackendBootstrap()) {
    await ensureBackendBootstrapped()
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
    await runElevatedPowerShell(repair, ['-InstallDir', installRoot(), '-ForceBootstrap'])
    return getBackendServiceStatus()
  } catch {
    /* fall through */
  }
  try {
    const boot = await ensureBackendBootstrapped()
    if (boot.ok) return getBackendServiceStatus()
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
