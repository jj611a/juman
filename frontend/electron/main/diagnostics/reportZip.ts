import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog } from 'electron'
import type { DiagnosticsReportResult, DiagnosticsRunResult } from '../../shared/diagnostics'
import { installRoot } from '../hardware/serviceStatus'
import { collectDiagnosticLogs } from './logCollectors'
import { nowIso, parseEnvFileDetailed, redactEnv, runCmd, jumanEnvPath } from './util'

export async function exportDiagnosticsReport(
  run: DiagnosticsRunResult | null
): Promise<DiagnosticsReportResult> {
  const root = installRoot()
  const logsDir = join(root, 'logs')
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })

  const stamp = nowIso().replace(/[:.]/g, '-')
  const staging = join(app.getPath('temp'), `juman-diag-${stamp}`)
  mkdirSync(staging, { recursive: true })

  try {
    const envParsed = parseEnvFileDetailed(jumanEnvPath())
    const logs = collectDiagnosticLogs()

    writeFileSync(
      join(staging, 'system-information.json'),
      JSON.stringify(
        {
          generatedAt: nowIso(),
          platform: process.platform,
          arch: process.arch,
          versions: process.versions,
          appVersion: app.getVersion(),
          installRoot: root
        },
        null,
        2
      ),
      'utf8'
    )

    writeFileSync(
      join(staging, 'configuration.redacted.json'),
      JSON.stringify(
        {
          path: jumanEnvPath(),
          exists: envParsed.exists,
          readable: envParsed.readable,
          parseErrors: envParsed.parseErrors,
          values: redactEnv(envParsed.map)
        },
        null,
        2
      ),
      'utf8'
    )

    writeFileSync(
      join(staging, 'environment.json'),
      JSON.stringify(
        {
          NODE_ENV: process.env.NODE_ENV,
          JUMAN_INSTALL_DIR: process.env.JUMAN_INSTALL_DIR || null
        },
        null,
        2
      ),
      'utf8'
    )

    writeFileSync(
      join(staging, 'health-report.json'),
      JSON.stringify(run ?? { error: 'no run yet' }, null, 2),
      'utf8'
    )

    const exceptions = (run?.checks || [])
      .filter((c) => c.error)
      .map((c) => ({ id: c.id, error: c.error, details: c.details }))
    writeFileSync(join(staging, 'exception-traces.json'), JSON.stringify(exceptions, null, 2), 'utf8')

    const logDir = join(staging, 'logs')
    mkdirSync(logDir, { recursive: true })
    logs.forEach((chunk, i) => {
      const name = `${String(i).padStart(2, '0')}-${chunk.source}.log`
      writeFileSync(
        join(logDir, name),
        `PATH: ${chunk.path || ''}\nTRUNCATED: ${chunk.truncated}\n\n${chunk.content}`,
        'utf8'
      )
    })

    const defaultPath = join(logsDir, `diagnostics-report-${stamp}.zip`)
    const save = await dialog.showSaveDialog({
      title: 'حفظ تقرير التشخيص',
      defaultPath,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (save.canceled || !save.filePath) {
      return { ok: false, path: '', error: 'cancelled' }
    }

    const zipPath = save.filePath.endsWith('.zip') ? save.filePath : `${save.filePath}.zip`
    const compress = await runCmd(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
      ],
      { timeoutMs: 120_000 }
    )
    if (compress.code !== 0) {
      return {
        ok: false,
        path: zipPath,
        error: compress.stderr || compress.stdout || `exit ${compress.code}`
      }
    }
    return { ok: true, path: zipPath }
  } catch (err) {
    return {
      ok: false,
      path: '',
      error: err instanceof Error ? err.stack || err.message : String(err)
    }
  } finally {
    try {
      rmSync(staging, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}
