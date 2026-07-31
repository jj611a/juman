import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiagnosticCheckResult, DiagnosticStatus } from '../../shared/diagnostics'
import { loadHardwareConfig } from '../hardware/configStore'
import { getBackendServiceStatus, installLogsHint } from '../hardware/serviceStatus'
import {
  REQUIRED_ENV_KEYS,
  apiExePath,
  app,
  getDiskFreeBytes,
  httpGetJson,
  installRoot,
  isElevatedApprox,
  jumanEnvPath,
  nowIso,
  parseEnvFileDetailed,
  portListeners,
  probeWritable,
  redactEnv,
  resolveHealthUrl,
  resolveVersionUrl,
  runApiDiagnose,
  runCmd,
  scQuery,
  sha256File,
  tcpReachable,
  PG_SERVICE
} from './util'

function worst(a: DiagnosticStatus, b: DiagnosticStatus): DiagnosticStatus {
  const rank = { PASS: 0, WARNING: 1, FAIL: 2 }
  return rank[a] >= rank[b] ? a : b
}

async function timed(
  id: DiagnosticCheckResult['id'],
  title: string,
  titleAr: string,
  fn: () => Promise<{ status: DiagnosticStatus; details: string; error?: string; evidence: Record<string, unknown> }>
): Promise<DiagnosticCheckResult> {
  const started = Date.now()
  const timestamp = nowIso()
  try {
    const r = await fn()
    return {
      id,
      title,
      titleAr,
      status: r.status,
      durationMs: Date.now() - started,
      timestamp,
      details: r.details,
      error: r.error,
      evidence: r.evidence
    }
  } catch (err) {
    const error = err instanceof Error ? (err.stack || err.message) : String(err)
    return {
      id,
      title,
      titleAr,
      status: 'FAIL',
      durationMs: Date.now() - started,
      timestamp,
      details: 'Unhandled exception during check',
      error,
      evidence: { exception: error }
    }
  }
}

export async function checkAppInfo(): Promise<DiagnosticCheckResult> {
  return timed('app_info', 'Application Information', 'معلومات التطبيق', async () => {
    const root = installRoot()
    const env = parseEnvFileDetailed(jumanEnvPath()).map
    const runtimeDir = join(root, 'runtime')
    const updateChannel = join(runtimeDir, 'update-channel.json')
    let manifest: unknown = null
    if (existsSync(updateChannel)) {
      try {
        manifest = JSON.parse(readFileSync(updateChannel, 'utf8'))
      } catch (err) {
        manifest = { error: err instanceof Error ? err.message : String(err) }
      }
    }
    let backendVersion: unknown = null
    const ver = await httpGetJson(resolveVersionUrl(env), 4000)
    if (ver.ok) backendVersion = ver.body

    const evidence = {
      applicationVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      backendVersion,
      installerVersion: app.getVersion(),
      buildManifest: manifest,
      configurationPath: jumanEnvPath(),
      storagePath: env.MEDIA_STORAGE_ROOT || join(root, 'storage'),
      dataPath: join(root, 'data'),
      logsPath: installLogsHint(),
      installRoot: root
    }
    return {
      status: 'PASS',
      details: `App ${evidence.applicationVersion} · Electron ${evidence.electronVersion}`,
      evidence
    }
  })
}

export async function checkConfiguration(): Promise<DiagnosticCheckResult> {
  return timed('configuration', 'Configuration', 'الإعدادات', async () => {
    const path = jumanEnvPath()
    const parsed = parseEnvFileDetailed(path)
    const missing = REQUIRED_ENV_KEYS.filter((k) => !parsed.map[k]?.trim())
    const invalid: string[] = []
    const port = Number(parsed.map.PORT || '')
    if (parsed.map.PORT && (!Number.isFinite(port) || port < 1 || port > 65535)) {
      invalid.push(`PORT invalid: ${parsed.map.PORT}`)
    }
    if (parsed.map.DATABASE_URL && !/postgres/i.test(parsed.map.DATABASE_URL)) {
      invalid.push('DATABASE_URL does not look like a PostgreSQL URL')
    }

    let status: DiagnosticStatus = 'PASS'
    if (!parsed.exists || !parsed.readable) status = 'FAIL'
    else if (parsed.parseErrors.length || missing.length || invalid.length) status = 'FAIL'
    else if (!parsed.map.HOST) status = 'WARNING'

    const detailsParts = [
      parsed.exists ? 'config exists' : 'config missing',
      parsed.readable ? 'readable' : 'unreadable',
      missing.length ? `missing: ${missing.join(', ')}` : 'required keys present',
      parsed.parseErrors.length ? `parse errors: ${parsed.parseErrors.length}` : 'env syntax ok'
    ]

    return {
      status,
      details: detailsParts.join(' · '),
      error:
        [...parsed.parseErrors, ...invalid, ...missing.map((m) => `Missing ${m}`)].join('\n') ||
        undefined,
      evidence: {
        path,
        exists: parsed.exists,
        readable: parsed.readable,
        parseErrors: parsed.parseErrors,
        missingKeys: missing,
        invalid,
        parsedConfiguration: redactEnv(parsed.map),
        note: 'Install config is KEY=VALUE (juman.env), not JSON/YAML'
      }
    }
  })
}

export async function checkFilesystem(): Promise<DiagnosticCheckResult> {
  return timed('filesystem', 'Filesystem', 'نظام الملفات', async () => {
    const root = installRoot()
    const env = parseEnvFileDetailed(jumanEnvPath()).map
    const dirs = {
      storage: env.MEDIA_STORAGE_ROOT || join(root, 'storage'),
      logs: join(root, 'logs'),
      media: join(env.MEDIA_STORAGE_ROOT || join(root, 'storage'), 'media'),
      backup: join(root, 'storage', 'backups'),
      temporary: join(root, 'runtime', 'tmp'),
      data: join(root, 'data')
    }
    const probes: Record<string, { exists: boolean; writable: boolean; error?: string }> = {}
    let status: DiagnosticStatus = 'PASS'
    for (const [name, path] of Object.entries(dirs)) {
      const exists = existsSync(path)
      const w = probeWritable(path)
      probes[name] = { exists, writable: w.ok, error: w.error }
      if (!w.ok) status = 'FAIL'
      else if (!exists) status = worst(status, 'WARNING')
    }
    const free = await getDiskFreeBytes(root)
    const WARN = 2 * 1024 * 1024 * 1024
    if (free != null && free < WARN) status = worst(status, 'WARNING')

    return {
      status,
      details: `Disk free: ${free == null ? 'unknown' : `${Math.round(free / 1e9)} GB`}`,
      evidence: { directories: probes, diskFreeBytes: free, installRoot: root }
    }
  })
}

export async function checkPostgreSQL(): Promise<DiagnosticCheckResult> {
  return timed('postgresql', 'PostgreSQL', 'PostgreSQL', async () => {
    const prefix = join(process.env['ProgramFiles'] || 'C:\\Program Files', 'PostgreSQL', '16')
    const exe = join(prefix, 'bin', 'postgres.exe')
    const dataDir = join(
      process.env['ProgramData'] || 'C:\\ProgramData',
      'Juman',
      'PostgreSQL',
      '16',
      'data'
    )
    const svc = await scQuery(PG_SERVICE)
    let version: string | null = null
    if (existsSync(exe)) {
      const v = await runCmd(exe, ['--version'])
      version = (v.stdout || v.stderr).trim() || null
    }
    const portOk = await tcpReachable('127.0.0.1', 5432)
    const diagnose = await runApiDiagnose()
    const db = (diagnose.json || {}) as Record<string, unknown>

    let status: DiagnosticStatus = 'PASS'
    if (!existsSync(exe)) status = 'FAIL'
    if (!svc.exists) status = 'FAIL'
    if (svc.exists && !svc.running) status = worst(status, 'FAIL')
    if (!existsSync(dataDir)) status = worst(status, 'WARNING')
    if (!portOk) status = worst(status, 'FAIL')

    const authOk = db.connectionOk === true
    if (diagnose.json && !authOk) status = worst(status, 'FAIL')

    return {
      status,
      details: [
        svc.exists ? (svc.running ? 'service RUNNING' : 'service STOPPED') : 'service missing',
        version || 'exe missing',
        portOk ? 'port 5432 reachable' : 'port 5432 closed',
        authOk ? 'auth ok' : 'auth/connection unknown or failed'
      ].join(' · '),
      error: diagnose.stderr || (db.error as string | undefined),
      evidence: {
        installed: existsSync(exe),
        executable: exe,
        version,
        service: svc,
        dataDirectory: dataDir,
        dataDirectoryExists: existsSync(dataDir),
        portReachable: portOk,
        authenticationWorks: authOk,
        databaseExists: db.databaseExists ?? null,
        databaseUserExists: db.userExists ?? null,
        diagnose
      }
    }
  })
}

export async function checkDatabase(): Promise<DiagnosticCheckResult> {
  return timed('database', 'Database', 'قاعدة البيانات', async () => {
    const diagnose = await runApiDiagnose()
    const j = (diagnose.json || {}) as Record<string, unknown>
    let status: DiagnosticStatus = diagnose.json ? 'PASS' : 'FAIL'
    if (j.connectionOk !== true) status = 'FAIL'
    if (j.pendingMigrations === true) status = worst(status, 'WARNING')
    if (typeof j.latencyMs === 'number' && (j.latencyMs as number) > 500) {
      status = worst(status, 'WARNING')
    }
    return {
      status,
      details: j.connectionOk
        ? `connected · latency ${j.latencyMs ?? '?'} ms · schema ${j.schemaVersion ?? '?'}`
        : 'connection failed',
      error: (j.error as string) || diagnose.stderr || undefined,
      evidence: {
        connectionSuccessful: j.connectionOk === true,
        schemaVersion: j.schemaVersion ?? null,
        latestMigration: j.alembicHead ?? null,
        migrationStatus: j.migrationStatus ?? null,
        pendingMigrations: j.pendingMigrations ?? null,
        latencyMs: j.latencyMs ?? null,
        diagnoseJson: j,
        exitCode: diagnose.code,
        stdout: diagnose.stdout.slice(0, 4000),
        stderr: diagnose.stderr.slice(0, 4000)
      }
    }
  })
}

export async function checkAlembic(): Promise<DiagnosticCheckResult> {
  return timed('alembic', 'Alembic', 'Alembic', async () => {
    const diagnose = await runApiDiagnose()
    const j = (diagnose.json || {}) as Record<string, unknown>
    let status: DiagnosticStatus = diagnose.json ? 'PASS' : 'WARNING'
    if (j.pendingMigrations === true) status = 'WARNING'
    if (j.connectionOk === false) status = 'FAIL'
    return {
      status,
      details: `HEAD=${j.alembicHead ?? '?'} · current=${j.schemaVersion ?? '?'} · downgrade disabled (expected)`,
      error: (j.error as string) || undefined,
      evidence: {
        migrationHistory: j.migrationHistory ?? null,
        head: j.alembicHead ?? null,
        revision: j.schemaVersion ?? null,
        upgradePossible: j.upgradePossible ?? null,
        downgradeDisabled: true,
        downgradeNote: 'Downgrade is disabled by design for production safety'
      }
    }
  })
}

export async function checkBackend(): Promise<DiagnosticCheckResult> {
  return timed('backend', 'Backend', 'الخادم الخلفي', async () => {
    const exe = apiExePath()
    const exists = existsSync(exe)
    const hash = exists ? sha256File(exe) : null
    const svc = await getBackendServiceStatus()
    const env = parseEnvFileDetailed(jumanEnvPath()).map
    const healthUrl = resolveHealthUrl(env)
    const t0 = Date.now()
    const diagnose = await runApiDiagnose()
    const diagnoseMs = Date.now() - t0
    const health = await httpGetJson(healthUrl, 5000)

    let status: DiagnosticStatus = 'PASS'
    if (!exists) status = 'FAIL'
    if (svc.state !== 'running') status = worst(status, 'FAIL')
    if (!health.ok) status = worst(status, 'FAIL')
    if (diagnose.code !== 0 && diagnose.code !== 1) status = worst(status, 'WARNING')

    return {
      status,
      details: [
        exists ? 'juman-api.exe present' : 'juman-api.exe missing',
        `service ${svc.state}`,
        health.ok ? 'health OK' : 'health FAIL',
        `diagnose exit=${diagnose.code}`
      ].join(' · '),
      error: !health.ok ? health.error : diagnose.stderr || undefined,
      evidence: {
        executable: exe,
        exists,
        sha256: hash,
        service: svc,
        diagnoseExitCode: diagnose.code,
        diagnoseStdout: diagnose.stdout.slice(0, 6000),
        diagnoseStderr: diagnose.stderr.slice(0, 6000),
        health,
        healthUrl,
        startupTimeMs: diagnoseMs,
        crashDetection: diagnose.code > 1 ? 'possible crash / missing deps' : 'no crash detected'
      }
    }
  })
}

export async function checkElectronBackend(): Promise<DiagnosticCheckResult> {
  return timed('electron_backend', 'Electron ↔ Backend', 'Electron ↔ Backend', async () => {
    const env = parseEnvFileDetailed(jumanEnvPath()).map
    const health = await httpGetJson(resolveHealthUrl(env), 5000)
    const ipcBridgeAvailable = true // we are inside main; preload exposed separately validated by renderer
    let status: DiagnosticStatus = health.ok ? 'PASS' : 'FAIL'
    return {
      status,
      details: health.ok ? 'health reachable from main' : 'health unreachable',
      error: health.error,
      evidence: {
        healthEndpointReachable: health.ok,
        health,
        ipcBridge: ipcBridgeAvailable,
        apiClient: 'preload juman.api.system.health',
        rendererCommunication: 'validated in UI via diagnostics.ping'
      }
    }
  })
}

export async function checkPorts(): Promise<DiagnosticCheckResult> {
  return timed('ports', 'Ports', 'المنافذ', async () => {
    const env = parseEnvFileDetailed(jumanEnvPath()).map
    const port = Number(env.PORT || '8000')
    const listeners = await portListeners(port)
    const jumanPids = listeners.filter((l) =>
      /juman|uvicorn|python/i.test(l.processName || '')
    )
    let status: DiagnosticStatus = 'PASS'
    if (listeners.length && jumanPids.length === 0) status = 'WARNING'
    const reachable = await tcpReachable('127.0.0.1', port)
    if (!reachable && listeners.length === 0) status = worst(status, 'WARNING')

    return {
      status,
      details: `PORT=${port} · listeners=${listeners.length} · reachable=${reachable}`,
      evidence: {
        configuredBackendPort: port,
        alreadyInUse: listeners.length > 0,
        listeners,
        conflictingProcess: listeners.find((l) => !/juman/i.test(l.processName || '')) || null
      }
    }
  })
}

export async function checkPermissions(): Promise<DiagnosticCheckResult> {
  return timed('permissions', 'Permissions', 'الصلاحيات', async () => {
    const root = installRoot()
    const elevated = await isElevatedApprox()
    const folders = ['config', 'logs', 'storage', 'data'].map((n) => {
      const path = join(root, n)
      const w = probeWritable(path)
      return { path, ...w }
    })
    let status: DiagnosticStatus = folders.every((f) => f.ok) ? 'PASS' : 'FAIL'
    if (!elevated) status = worst(status, 'WARNING')

    return {
      status,
      details: elevated
        ? 'running elevated'
        : 'not elevated — service repairs require UAC',
      evidence: {
        administratorPrivileges: elevated,
        folderPermissions: folders,
        databasePermissions: 'see diagnose / PostgreSQL service account',
        servicePermissions: 'LocalSystem / NetworkService via WinSW + EDB'
      }
    }
  })
}

export async function checkHardware(): Promise<DiagnosticCheckResult> {
  return timed('hardware', 'Hardware configuration', 'إعدادات الأجهزة', async () => {
    let config: unknown
    let error: string | undefined
    try {
      config = loadHardwareConfig()
    } catch (err) {
      error = err instanceof Error ? err.stack || err.message : String(err)
      return {
        status: 'FAIL',
        details: 'hardware-station.json invalid',
        error,
        evidence: { exception: error }
      }
    }
    const c = config as {
      cameraDeviceId?: string | null
      receiptPrinterName?: string | null
      labelPrinterName?: string | null
      receiptTransport?: string
      scanMinLength?: number
    }
    const warnings: string[] = []
    if (!c.receiptPrinterName && !c.labelPrinterName) {
      warnings.push('no printers configured (ok if unused)')
    }
    return {
      status: 'PASS',
      details: warnings.length
        ? `config valid · ${warnings.join('; ')}`
        : 'hardware config valid (no device I/O)',
      evidence: {
        camera: { deviceId: c.cameraDeviceId ?? null },
        barcode: { scanMinLength: c.scanMinLength ?? null },
        printer: {
          receipt: c.receiptPrinterName,
          label: c.labelPrinterName,
          transport: c.receiptTransport
        },
        fullConfig: config,
        note: 'Configuration validation only — no device testing'
      }
    }
  })
}

export const ALL_CHECKS = [
  checkAppInfo,
  checkConfiguration,
  checkFilesystem,
  checkPostgreSQL,
  checkDatabase,
  checkAlembic,
  checkBackend,
  checkElectronBackend,
  checkPorts,
  checkPermissions,
  checkHardware
] as const
