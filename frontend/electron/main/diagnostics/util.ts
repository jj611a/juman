import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  unlinkSync
} from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { installRoot, jumanEnvPath, readJumanEnv } from '../hardware/serviceStatus'

const execFileAsync = promisify(execFile)

export const PG_SERVICE = 'postgresql-x64-16'
export const HEALTH_URL_DEFAULT = 'http://127.0.0.1:8000/api/v1/health'
export const VERSION_URL_DEFAULT = 'http://127.0.0.1:8000/api/v1/version'

export const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'SECRET_KEY',
  'PORT',
  'MEDIA_STORAGE_ROOT'
] as const

export const SECRET_ENV_KEYS = new Set([
  'SECRET_KEY',
  'DATABASE_URL',
  'IDENTITY_BOOTSTRAP_PASSWORD',
  'PG_SUPER_PASSWORD',
  'POSTGRES_PASSWORD'
])

export function nowIso(): string {
  return new Date().toISOString()
}

export function maskValue(key: string, value: string): string {
  if (!SECRET_ENV_KEYS.has(key) && !/PASSWORD|SECRET|TOKEN|KEY/i.test(key)) {
    return value
  }
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}…${value.slice(-2)} (${value.length} chars)`
}

export function redactEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    out[k] = maskValue(k, v)
  }
  return out
}

export function parseEnvFileDetailed(path: string): {
  exists: boolean
  readable: boolean
  map: Record<string, string>
  parseErrors: string[]
  rawLineCount: number
} {
  const parseErrors: string[] = []
  const map: Record<string, string> = {}
  if (!existsSync(path)) {
    return { exists: false, readable: false, map, parseErrors: ['File missing'], rawLineCount: 0 }
  }
  let text: string
  try {
    accessSync(path, constants.R_OK)
    text = readFileSync(path, 'utf8')
  } catch (err) {
    return {
      exists: true,
      readable: false,
      map,
      parseErrors: [err instanceof Error ? err.message : String(err)],
      rawLineCount: 0
    }
  }
  const lines = text.split(/\r?\n/)
  lines.forEach((line, idx) => {
    const raw = line.trim()
    if (!raw || raw.startsWith('#')) return
    if (!raw.includes('=')) {
      parseErrors.push(`Line ${idx + 1}: expected KEY=VALUE`)
      return
    }
    const i = raw.indexOf('=')
    const key = raw.slice(0, i).trim()
    const value = raw.slice(i + 1).trim()
    if (!key) {
      parseErrors.push(`Line ${idx + 1}: empty key`)
      return
    }
    map[key] = value
  })
  return { exists: true, readable: true, map, parseErrors, rawLineCount: lines.length }
}

export async function runCmd(
  file: string,
  args: string[],
  opts?: { timeoutMs?: number; cwd?: string }
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      windowsHide: true,
      timeout: opts?.timeoutMs ?? 60_000,
      cwd: opts?.cwd,
      maxBuffer: 8 * 1024 * 1024
    })
    return { code: 0, stdout: String(stdout), stderr: String(stderr) }
  } catch (err) {
    const e = err as {
      code?: number | string
      stdout?: string | Buffer
      stderr?: string | Buffer
      message?: string
    }
    return {
      code: typeof e.code === 'number' ? e.code : 1,
      stdout: e.stdout ? String(e.stdout) : '',
      stderr: e.stderr ? String(e.stderr) : e.message || String(err)
    }
  }
}

export function sha256File(path: string): string | null {
  if (!existsSync(path)) return null
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

export function probeWritable(dir: string): { ok: boolean; error?: string } {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    accessSync(dir, constants.R_OK | constants.W_OK)
    const probe = join(dir, `.juman-diag-${process.pid}.tmp`)
    writeFileSync(probe, 'ok', 'utf8')
    unlinkSync(probe)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function diskFreeBytes(targetPath: string): number | null {
  if (process.platform !== 'win32') return null
  try {
    const root = targetPath.slice(0, 2)
    // wmic is deprecated but widely available; PowerShell fallback below
    return null
  } catch {
    return null
  }
}

export async function getDiskFreeBytes(targetPath: string): Promise<number | null> {
  if (process.platform !== 'win32') return null
  const drive = (targetPath.match(/^[A-Za-z]:/)?.[0] || 'C:').replace(':', '')
  const ps = `(Get-PSDrive -Name '${drive}').Free`
  const r = await runCmd('powershell.exe', ['-NoProfile', '-Command', ps], { timeoutMs: 15_000 })
  const n = Number(String(r.stdout).trim())
  return Number.isFinite(n) ? n : null
}

export async function scQuery(serviceName: string): Promise<{
  exists: boolean
  running: boolean
  raw: string
  startType?: string
}> {
  const q = await runCmd('sc.exe', ['query', serviceName])
  const exists = /SERVICE_NAME/i.test(q.stdout) || q.code === 0
  const running = /STATE\s*:\s*\d+\s+RUNNING/i.test(q.stdout)
  let startType: string | undefined
  const qc = await runCmd('sc.exe', ['qc', serviceName])
  const m = qc.stdout.match(/START_TYPE\s*:\s*\d+\s+(\w+)/i)
  if (m) startType = m[1]
  return { exists: exists && !/FAILED|does not exist/i.test(q.stderr + q.stdout), running, raw: q.stdout || q.stderr, startType }
}

export async function tcpReachable(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  const ps = `
$c = New-Object System.Net.Sockets.TcpClient
try {
  $iar = $c.BeginConnect('${host}', ${port}, $null, $null)
  $ok = $iar.AsyncWaitHandle.WaitOne(${timeoutMs}, $false)
  if (-not $ok) { $c.Close(); exit 1 }
  $c.EndConnect($iar) | Out-Null
  $c.Close()
  exit 0
} catch { exit 1 }
`
  const r = await runCmd('powershell.exe', ['-NoProfile', '-Command', ps], {
    timeoutMs: timeoutMs + 2000
  })
  return r.code === 0
}

export async function portListeners(port: number): Promise<
  Array<{ pid: number | null; processName: string | null; raw: string }>
> {
  const r = await runCmd(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object OwningProcess,State | ConvertTo-Json -Compress`
    ],
    { timeoutMs: 20_000 }
  )
  if (!r.stdout.trim()) return []
  try {
    const parsed = JSON.parse(r.stdout) as
      | { OwningProcess?: number; State?: string }
      | Array<{ OwningProcess?: number; State?: string }>
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const out: Array<{ pid: number | null; processName: string | null; raw: string }> = []
    for (const row of rows) {
      const pid = row.OwningProcess ?? null
      let processName: string | null = null
      if (pid) {
        const pn = await runCmd(
          'powershell.exe',
          ['-NoProfile', '-Command', `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName`],
          { timeoutMs: 10_000 }
        )
        processName = pn.stdout.trim() || null
      }
      out.push({ pid, processName, raw: JSON.stringify(row) })
    }
    return out
  } catch {
    return [{ pid: null, processName: null, raw: r.stdout }]
  }
}

export async function httpGetJson(
  url: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string; ms: number }> {
  const started = Date.now()
  const ps = `
try {
  $r = Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec ${Math.ceil(timeoutMs / 1000)}
  Write-Output $r.StatusCode
  Write-Output '---BODY---'
  Write-Output $r.Content
  exit 0
} catch {
  Write-Output $_.Exception.Message
  exit 1
}
`
  const r = await runCmd('powershell.exe', ['-NoProfile', '-Command', ps], {
    timeoutMs: timeoutMs + 3000
  })
  const ms = Date.now() - started
  if (r.code !== 0) {
    return { ok: false, error: r.stdout || r.stderr, ms }
  }
  const parts = r.stdout.split('---BODY---')
  const status = Number(parts[0]?.trim())
  const bodyRaw = (parts[1] || '').trim()
  let body: unknown = bodyRaw
  try {
    body = JSON.parse(bodyRaw)
  } catch {
    /* keep text */
  }
  return { ok: status >= 200 && status < 300, status, body, ms }
}

export function apiExePath(): string {
  return join(installRoot(), 'backend', 'juman-api.exe')
}

let _diagnoseCache: {
  code: number
  stdout: string
  stderr: string
  json: Record<string, unknown> | null
} | null = null

export function clearDiagnoseCache(): void {
  _diagnoseCache = null
}

export async function runApiDiagnose(): Promise<{
  code: number
  stdout: string
  stderr: string
  json: Record<string, unknown> | null
}> {
  if (_diagnoseCache) return _diagnoseCache
  const exe = apiExePath()
  if (!existsSync(exe)) {
    _diagnoseCache = { code: 127, stdout: '', stderr: `Missing ${exe}`, json: null }
    return _diagnoseCache
  }
  const r = await runCmd(exe, ['diagnose', '--json'], { timeoutMs: 90_000 })
  let json: Record<string, unknown> | null = null
  const text = r.stdout.trim()
  if (text) {
    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        json = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
      }
    } catch (err) {
      json = { parseError: err instanceof Error ? err.message : String(err), raw: text.slice(0, 2000) }
    }
  }
  _diagnoseCache = { ...r, json }
  return _diagnoseCache
}

export function isElevatedApprox(): Promise<boolean> {
  return (async () => {
    if (process.platform !== 'win32') return false
    const r = await runCmd(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
      ],
      { timeoutMs: 10_000 }
    )
    return /True/i.test(r.stdout)
  })()
}

export function listDirSafe(path: string): string[] {
  try {
    if (!existsSync(path)) return []
    return readdirSync(path)
  } catch {
    return []
  }
}

export function fileSize(path: string): number | null {
  try {
    return statSync(path).size
  } catch {
    return null
  }
}

export function resolveHealthUrl(env: Record<string, string>): string {
  const port = env.PORT || '8000'
  const host = env.HOST || '127.0.0.1'
  return `http://${host}:${port}/api/v1/health`
}

export function resolveVersionUrl(env: Record<string, string>): string {
  const port = env.PORT || '8000'
  const host = env.HOST || '127.0.0.1'
  return `http://${host}:${port}/api/v1/version`
}

export function getEnvMap(): Record<string, string> {
  const parsed = parseEnvFileDetailed(jumanEnvPath())
  return parsed.map
}

export { installRoot, jumanEnvPath, readJumanEnv, app }
