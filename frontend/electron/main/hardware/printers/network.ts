import net from 'node:net'
import type { PrinterInfo, SavedNetworkPrinter } from '../../../shared/hardware'
import { HardwareErrorCodes } from '../../../shared/hardware'

export class NetworkPrintError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NetworkPrintError'
    this.code = code
  }
}

function mapSocketError(err: NodeJS.ErrnoException): NetworkPrintError {
  const code = err.code ?? ''
  if (code === 'ETIMEDOUT' || code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
    return new NetworkPrintError(HardwareErrorCodes.CONNECTION_TIMEOUT, 'Connection timed out')
  }
  if (code === 'ECONNREFUSED') {
    return new NetworkPrintError(HardwareErrorCodes.CONNECTION_REFUSED, 'Connection refused')
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ENOTFOUND') {
    return new NetworkPrintError(HardwareErrorCodes.PRINTER_OFFLINE, 'Printer host unreachable')
  }
  if (code === 'ECONNRESET') {
    return new NetworkPrintError(HardwareErrorCodes.PRINTER_UNAVAILABLE, 'Connection reset by printer')
  }
  return new NetworkPrintError(
    HardwareErrorCodes.UNKNOWN_DEVICE,
    err.message || 'Unknown network printer error'
  )
}

/**
 * Open a TCP socket to an ESC/POS printer (typically port 9100), write raw bytes, then close.
 */
export async function sendRawToNetworkPrinter(
  host: string,
  port: number,
  data: Buffer,
  timeoutMs = 5000
): Promise<void> {
  if (!host?.trim()) {
    throw new NetworkPrintError(HardwareErrorCodes.HOST_NOT_CONFIGURED, 'Network printer host not configured')
  }
  const safePort = Number.isFinite(port) && port > 0 ? port : 9100
  const timeout = Math.max(500, Math.min(60000, timeoutMs))

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(err instanceof NetworkPrintError ? err : mapSocketError(err as NodeJS.ErrnoException))
    }

    const succeed = (): void => {
      if (settled) return
      settled = true
      socket.end()
      resolve()
    }

    socket.setTimeout(timeout)

    socket.once('timeout', () => {
      fail(new NetworkPrintError(HardwareErrorCodes.CONNECTION_TIMEOUT, 'Connection timed out'))
    })

    socket.once('error', (err) => fail(err))

    socket.connect(safePort, host.trim(), () => {
      socket.write(data, (writeErr) => {
        if (writeErr) {
          fail(writeErr)
          return
        }
        // Give the printer a brief moment to accept the job, then close.
        socket.end(() => succeed())
      })
    })
  })
}

/** TCP connect probe (no payload) — online if connect succeeds. */
export async function probeNetworkPrinter(
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<{ ok: boolean; status: 'online' | 'offline'; code?: string; message: string }> {
  if (!host?.trim()) {
    return {
      ok: false,
      status: 'offline',
      code: HardwareErrorCodes.HOST_NOT_CONFIGURED,
      message: 'Network printer host not configured'
    }
  }
  const safePort = Number.isFinite(port) && port > 0 ? port : 9100
  const timeout = Math.max(500, Math.min(60000, timeoutMs))

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()
      let settled = false

      const finish = (err?: Error): void => {
        if (settled) return
        settled = true
        socket.destroy()
        if (err) reject(err)
        else resolve()
      }

      socket.setTimeout(timeout)
      socket.once('timeout', () => {
        finish(new NetworkPrintError(HardwareErrorCodes.CONNECTION_TIMEOUT, 'Connection timed out'))
      })
      socket.once('error', (err) => finish(err))
      socket.connect(safePort, host.trim(), () => finish())
    })
    return { ok: true, status: 'online', message: 'Printer reachable' }
  } catch (err) {
    const mapped =
      err instanceof NetworkPrintError ? err : mapSocketError(err as NodeJS.ErrnoException)
    return {
      ok: false,
      status: 'offline',
      code: mapped.code,
      message: mapped.message
    }
  }
}

export async function listNetworkPrinterTargets(
  printers: SavedNetworkPrinter[],
  activeId: string | null,
  timeoutMs: number,
  probeActive = true
): Promise<PrinterInfo[]> {
  if (!printers.length) return []

  const results: PrinterInfo[] = []
  for (const p of printers) {
    const isActive = p.id === activeId
    let status = 'configured'
    if (probeActive && isActive) {
      const probe = await probeNetworkPrinter(p.host, p.port, timeoutMs)
      status = probe.status
    }
    results.push({
      name: `${p.name} (${p.host}:${p.port})`,
      isDefault: isActive,
      status,
      transport: 'network'
    })
  }
  return results
}
