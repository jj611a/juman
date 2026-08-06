import type {
  HardwareStationConfig,
  PrinterKind,
  PrintStatus,
  SavedNetworkPrinter
} from '../../../shared/hardware'
import { HardwareErrorCodes } from '../../../shared/hardware'
import { NetworkPrintError, sendRawToNetworkPrinter } from './network'
import { sendRawToUsbPrinter } from './usb'

export function resolveActiveNetworkTarget(
  config: HardwareStationConfig
): SavedNetworkPrinter | null {
  if (config.activeNetworkPrinterId) {
    const found = config.savedNetworkPrinters.find((p) => p.id === config.activeNetworkPrinterId)
    if (found) return found
  }
  if (config.networkReceiptHost) {
    return {
      id: 'legacy',
      name: 'Network',
      host: config.networkReceiptHost,
      port: config.networkReceiptPort || 9100
    }
  }
  if (config.savedNetworkPrinters.length === 1) {
    return config.savedNetworkPrinters[0]
  }
  return null
}

function resolveUsbName(config: HardwareStationConfig, kind: PrinterKind): string | null {
  if (kind === 'label') {
    return config.labelPrinterName ?? config.receiptPrinterName
  }
  return config.receiptPrinterName
}

/**
 * Unified print router: USB spool or TCP ESC/POS based on station config.
 * Label jobs use USB when an explicit label printer is selected; otherwise follow receipt transport.
 */
export async function sendRaw(
  config: HardwareStationConfig,
  kind: PrinterKind,
  data: Buffer
): Promise<PrintStatus> {
  const at = new Date().toISOString()

  const preferUsbLabel = kind === 'label' && Boolean(config.labelPrinterName)
  const useNetwork = config.receiptTransport === 'network' && !preferUsbLabel

  if (useNetwork) {
    const target = resolveActiveNetworkTarget(config)
    if (!target?.host) {
      return {
        ok: false,
        message: 'Network printer host not configured',
        printerName: null,
        at,
        code: HardwareErrorCodes.HOST_NOT_CONFIGURED
      }
    }
    try {
      await sendRawToNetworkPrinter(
        target.host,
        target.port,
        data,
        config.networkConnectTimeoutMs
      )
      return {
        ok: true,
        message: 'Sent to network printer',
        printerName: `${target.host}:${target.port}`,
        at
      }
    } catch (error) {
      const code =
        error instanceof NetworkPrintError
          ? error.code
          : HardwareErrorCodes.PRINTER_UNAVAILABLE
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Print failed',
        printerName: `${target.host}:${target.port}`,
        at,
        code
      }
    }
  }

  const printerName = resolveUsbName(config, kind)
  if (!printerName) {
    return {
      ok: false,
      message: kind === 'label' ? 'Label printer not selected' : 'Receipt printer not selected',
      printerName: null,
      at,
      code: HardwareErrorCodes.PRINTER_NOT_SELECTED
    }
  }

  try {
    await sendRawToUsbPrinter(printerName, data)
    return {
      ok: true,
      message: 'Print job sent',
      printerName,
      at
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Print failed',
      printerName,
      at,
      code: HardwareErrorCodes.PRINTER_UNAVAILABLE
    }
  }
}
