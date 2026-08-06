import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { DiagnosticLogChunk, DiagnosticLogSource } from '../../shared/diagnostics'
import { installRoot } from '../hardware/serviceStatus'

const MAX_BYTES = 512 * 1024

function readTail(path: string, maxBytes = MAX_BYTES): { content: string; truncated: boolean } {
  if (!existsSync(path)) return { content: '', truncated: false }
  const buf = readFileSync(path)
  if (buf.length <= maxBytes) return { content: buf.toString('utf8'), truncated: false }
  return {
    content: buf.subarray(buf.length - maxBytes).toString('utf8'),
    truncated: true
  }
}

function newestMatching(dir: string, predicate: (name: string) => boolean): string | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter(predicate)
    .map((name) => {
      const path = join(dir, name)
      try {
        return { path, mtime: statSync(path).mtimeMs }
      } catch {
        return null
      }
    })
    .filter(Boolean) as Array<{ path: string; mtime: number }>
  files.sort((a, b) => b.mtime - a.mtime)
  return files[0]?.path ?? null
}

export function electronMainLogPath(): string {
  const dir = join(app.getPath('userData'), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'electron-main.log')
}

export function appendMainLog(line: string): void {
  try {
    const path = electronMainLogPath()
    appendFileSync(path, `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch {
    /* never throw from logging */
  }
}

export function collectDiagnosticLogs(): DiagnosticLogChunk[] {
  const root = installRoot()
  const chunks: DiagnosticLogChunk[] = []

  const push = (source: DiagnosticLogSource, path: string | null | undefined): void => {
    if (!path || !existsSync(path)) {
      chunks.push({
        source,
        path: path || undefined,
        content: path ? `(missing) ${path}` : '(no path)',
        truncated: false
      })
      return
    }
    const { content, truncated } = readTail(path)
    chunks.push({ source, path, content, truncated })
  }

  push('electron-main', electronMainLogPath())
  push('backend', newestMatching(join(root, 'logs'), (n) => /api|backend|juman/i.test(n)))
  push('backend', join(root, 'logs', 'juman-api.out.log'))
  push('backend', join(root, 'logs', 'juman-api.err.log'))
  push('service', join(root, 'backend', 'JumanApi.wrapper.log'))
  push('service', join(root, 'backend', 'JumanApi.out.log'))
  push('service', join(root, 'backend', 'JumanApi.err.log'))
  push('installer', join(root, 'logs', 'postgresql-install.log'))
  push('installer', join(root, 'logs', 'postgresql-edb-debugtrace.log'))

  const temp = process.env.TEMP || process.env.TMP || ''
  if (temp) {
    push(
      'installer',
      newestMatching(temp, (n) => /installbuilder_installer/i.test(n))
    )
  }

  const pgLogDir = join(
    process.env['ProgramData'] || 'C:\\ProgramData',
    'Juman',
    'PostgreSQL',
    '16',
    'data',
    'log'
  )
  push('postgresql', newestMatching(pgLogDir, (n) => /\.log$/i.test(n)))

  const pgAlt = join(
    process.env['ProgramFiles'] || 'C:\\Program Files',
    'PostgreSQL',
    '16',
    'data',
    'log'
  )
  push('postgresql', newestMatching(pgAlt, (n) => /\.log$/i.test(n)))

  return chunks
}
