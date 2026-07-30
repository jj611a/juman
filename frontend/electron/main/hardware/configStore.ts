import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HardwareStationConfig } from '../../shared/hardware'
import { DEFAULT_HARDWARE_CONFIG } from '../../shared/hardware'
import { normalizeHardwareConfig } from './configNormalize'

const FILE_NAME = 'hardware-station.json'

function configPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, FILE_NAME)
}

export { normalizeHardwareConfig, syncNetworkFields } from './configNormalize'

export function loadHardwareConfig(): HardwareStationConfig {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_HARDWARE_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<HardwareStationConfig>
    return normalizeHardwareConfig(raw)
  } catch {
    return { ...DEFAULT_HARDWARE_CONFIG }
  }
}

export function saveHardwareConfig(patch: Partial<HardwareStationConfig>): HardwareStationConfig {
  const next = normalizeHardwareConfig({ ...loadHardwareConfig(), ...patch })
  writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function recordPrintOutcome(
  ok: boolean,
  message: string,
  at = new Date().toISOString()
): HardwareStationConfig {
  if (ok) {
    return saveHardwareConfig({
      lastSuccessfulPrintAt: at,
      lastPrintError: null
    })
  }
  return saveHardwareConfig({
    lastPrintError: message
  })
}

export function recordProbeOutcome(
  ok: boolean,
  at = new Date().toISOString()
): HardwareStationConfig {
  return saveHardwareConfig({
    lastProbeAt: at,
    lastProbeOk: ok
  })
}
