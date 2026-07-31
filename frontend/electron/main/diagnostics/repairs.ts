import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { shell } from 'electron'
import type { DiagnosticRepairActionId, DiagnosticRepairResult } from '../../shared/diagnostics'
import {
  ensureInstallDirs,
  installRoot,
  repairBackendService,
  restartBackendService,
  startBackendService
} from '../hardware/serviceStatus'
import { runElevatedPowerShell } from './elevate'
import { apiExePath, nowIso, runApiDiagnose, runCmd, PG_SERVICE } from './util'

export async function runRepairAction(
  actionId: DiagnosticRepairActionId
): Promise<DiagnosticRepairResult> {
  const root = installRoot()
  try {
    switch (actionId) {
      case 'open_logs': {
        const p = join(root, 'logs')
        if (!existsSync(p)) mkdirSync(p, { recursive: true })
        await shell.openPath(p)
        return { actionId, ok: true, message: `Opened ${p}` }
      }
      case 'open_storage': {
        const p = join(root, 'storage')
        if (!existsSync(p)) mkdirSync(p, { recursive: true })
        await shell.openPath(p)
        return { actionId, ok: true, message: `Opened ${p}` }
      }
      case 'open_config': {
        const p = join(root, 'config')
        if (!existsSync(p)) mkdirSync(p, { recursive: true })
        await shell.openPath(p)
        return { actionId, ok: true, message: `Opened ${p}` }
      }
      case 'repair_config_dirs': {
        ensureInstallDirs(root)
        const script = join(root, 'scripts', 'set-install-acls.ps1')
        if (existsSync(script)) {
          await runElevatedPowerShell(script, ['-InstallDir', root])
        }
        return { actionId, ok: true, message: 'Install dirs ensured; ACLs refreshed if script present' }
      }
      case 'repair_acls': {
        const script = join(root, 'scripts', 'set-install-acls.ps1')
        if (!existsSync(script)) {
          return { actionId, ok: false, message: 'set-install-acls.ps1 missing', error: script }
        }
        await runElevatedPowerShell(script, ['-InstallDir', root])
        return { actionId, ok: true, message: 'ACLs repaired (elevated)' }
      }
      case 'restart_services': {
        const script = join(root, 'scripts', 'start-services-elevated.ps1')
        if (existsSync(script)) {
          await runElevatedPowerShell(script, ['-InstallDir', root])
        } else {
          await startBackendService()
        }
        return { actionId, ok: true, message: 'Services restart requested' }
      }
      case 'restart_postgresql': {
        await runCmd('sc.exe', ['stop', PG_SERVICE])
        await new Promise((r) => setTimeout(r, 1500))
        const start = await runCmd('sc.exe', ['start', PG_SERVICE])
        if (start.code !== 0) {
          const script = join(root, 'scripts', 'start-services-elevated.ps1')
          if (existsSync(script)) {
            await runElevatedPowerShell(script, ['-InstallDir', root])
          }
        }
        return {
          actionId,
          ok: true,
          message: 'PostgreSQL restart attempted',
          stdout: start.stdout,
          stderr: start.stderr
        }
      }
      case 'restart_backend': {
        await restartBackendService()
        return { actionId, ok: true, message: 'JumanApi restart requested' }
      }
      case 'repair_services': {
        await repairBackendService()
        return { actionId, ok: true, message: 'repair-install.ps1 / WinSW repair completed' }
      }
      case 'rerun_migrations': {
        const exe = apiExePath()
        if (!existsSync(exe)) {
          return { actionId, ok: false, message: 'juman-api.exe missing', error: exe }
        }
        // Prefer elevated repair path which also migrates; also run migrate directly
        const r = await runCmd(exe, ['migrate'], { timeoutMs: 180_000 })
        if (r.code !== 0) {
          const repair = join(root, 'scripts', 'repair-install.ps1')
          if (existsSync(repair)) {
            await runElevatedPowerShell(repair, ['-InstallDir', root])
          }
        }
        return {
          actionId,
          ok: r.code === 0,
          message: r.code === 0 ? 'migrate ok' : 'migrate failed — tried elevated repair',
          stdout: r.stdout,
          stderr: r.stderr,
          error: r.code === 0 ? undefined : r.stderr || `exit ${r.code}`
        }
      }
      case 'test_db_connection': {
        const d = await runApiDiagnose()
        const ok = d.json?.connectionOk === true
        return {
          actionId,
          ok,
          message: ok ? 'DB connection OK' : 'DB connection failed',
          stdout: d.stdout,
          stderr: d.stderr,
          error: ok ? undefined : (d.json?.error as string) || d.stderr || `exit ${d.code}`
        }
      }
      default: {
        const exhaustive: never = actionId
        return {
          actionId: exhaustive,
          ok: false,
          message: 'Unknown action',
          error: String(actionId)
        }
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.stack || err.message : String(err)
    return {
      actionId,
      ok: false,
      message: `Repair failed at ${nowIso()}`,
      error
    }
  }
}
