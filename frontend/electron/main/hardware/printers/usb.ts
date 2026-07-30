import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PrinterInfo } from '../../../shared/hardware'

const execFileAsync = promisify(execFile)

function powershell(command: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 }
  )
}

export async function listUsbPrinters(): Promise<PrinterInfo[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await powershell(
      'Get-CimInstance Win32_Printer | Select-Object Name,Default,PrinterStatus | ConvertTo-Json -Compress'
    )
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed) as
      | { Name: string; Default: boolean; PrinterStatus: number }
      | Array<{ Name: string; Default: boolean; PrinterStatus: number }>
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.filter((r) => r?.Name).map((r) => ({
      name: String(r.Name),
      isDefault: Boolean(r.Default),
      status: statusLabel(Number(r.PrinterStatus)),
      transport: 'usb' as const
    }))
  } catch {
    return []
  }
}

function statusLabel(code: number): string {
  switch (code) {
    case 3: return 'idle'
    case 4: return 'printing'
    case 5: return 'warmup'
    case 7: return 'offline'
    default: return `status:${code}`
  }
}

/** Send RAW bytes via copy to Windows printer share path (no vendor SDK). */
export async function sendRawToUsbPrinter(printerName: string, data: Buffer): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('USB printing is available on Windows only')
  }
  const dir = mkdtempSync(join(tmpdir(), 'juman-print-'))
  const binPath = join(dir, 'job.bin')
  writeFileSync(binPath, data)
  const share = `\\localhost\${printerName}`
  try {
    await execFileAsync('cmd.exe', ['/c', 'copy', '/b', binPath, share], { windowsHide: true })
  } finally {
    try { unlinkSync(binPath) } catch { /* ignore */ }
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}
