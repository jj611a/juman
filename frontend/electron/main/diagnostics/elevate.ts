import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Launch an elevated PowerShell script (UAC). Returns after process exits. */
export async function runElevatedPowerShell(scriptPath: string, args: string[]): Promise<void> {
  if (!existsSync(scriptPath)) {
    throw new Error(`Script missing: ${scriptPath}`)
  }
  const argList = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...args
  ]
    .map((a) => `'${a.replace(/'/g, "''")}'`)
    .join(',')
  const ps = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(${argList})`
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { windowsHide: true }
  )
}
