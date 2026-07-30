import { randomUUID } from 'node:crypto'
import {
  DEFAULT_HARDWARE_CONFIG,
  type HardwareStationConfig,
  type PaperWidthChars,
  type SavedNetworkPrinter,
  type TextEncoding
} from '../../shared/hardware'

function isPaperWidth(n: unknown): n is PaperWidthChars {
  return n === 32 || n === 42 || n === 48
}

function isEncoding(v: unknown): v is TextEncoding {
  return v === 'utf8' || v === 'windows-1256'
}

export function normalizeSavedNetworkPrinters(list: unknown): SavedNetworkPrinter[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      id: typeof row.id === 'string' && row.id ? row.id : randomUUID(),
      name: typeof row.name === 'string' && row.name ? row.name : 'Network printer',
      host: typeof row.host === 'string' ? row.host.trim() : '',
      port: typeof row.port === 'number' && row.port > 0 ? row.port : 9100
    }))
    .filter((p) => p.host.length > 0)
}

/** Sync legacy host/port with saved network targets. */
export function syncNetworkFields(config: HardwareStationConfig): HardwareStationConfig {
  const saved = normalizeSavedNetworkPrinters(config.savedNetworkPrinters)
  let activeId = config.activeNetworkPrinterId
  let host = config.networkReceiptHost
  let port = config.networkReceiptPort || 9100

  if (saved.length === 0 && host) {
    const id = randomUUID()
    saved.push({ id, name: `${host}:${port}`, host, port })
    activeId = id
  }

  if (activeId && !saved.some((p) => p.id === activeId)) {
    activeId = saved[0]?.id ?? null
  }

  if (!activeId && saved.length > 0) {
    activeId = saved[0].id
  }

  const active = saved.find((p) => p.id === activeId) ?? null
  if (active) {
    host = active.host
    port = active.port
  } else if (!host) {
    host = null
    port = 9100
  }

  return {
    ...config,
    savedNetworkPrinters: saved,
    activeNetworkPrinterId: activeId,
    networkReceiptHost: host,
    networkReceiptPort: port,
    networkConnectTimeoutMs: Math.max(
      500,
      Math.min(60000, Number(config.networkConnectTimeoutMs) || 5000)
    ),
    paperWidthChars: isPaperWidth(config.paperWidthChars) ? config.paperWidthChars : 42,
    textEncoding: isEncoding(config.textEncoding) ? config.textEncoding : 'utf8'
  }
}

export function normalizeHardwareConfig(
  raw: Partial<HardwareStationConfig>
): HardwareStationConfig {
  const merged: HardwareStationConfig = {
    ...DEFAULT_HARDWARE_CONFIG,
    ...raw,
    savedNetworkPrinters: normalizeSavedNetworkPrinters(
      raw.savedNetworkPrinters ?? DEFAULT_HARDWARE_CONFIG.savedNetworkPrinters
    )
  }
  return syncNetworkFields(merged)
}
