/** Desktop hardware contracts (station-local; not backend settings). */

export type HardwareTransport = 'usb' | 'network'

export type PrinterKind = 'receipt' | 'label'

export type PaperWidthChars = 32 | 42 | 48

export type TextEncoding = 'utf8' | 'windows-1256'

export type PrinterInfo = {
  name: string
  isDefault: boolean
  status: string
  transport: HardwareTransport
}

export type SavedNetworkPrinter = {
  id: string
  name: string
  host: string
  port: number
}

export type HardwareStationConfig = {
  receiptPrinterName: string | null
  labelPrinterName: string | null
  receiptTransport: HardwareTransport
  networkReceiptHost: string | null
  networkReceiptPort: number
  networkConnectTimeoutMs: number
  paperWidthChars: PaperWidthChars
  textEncoding: TextEncoding
  savedNetworkPrinters: SavedNetworkPrinter[]
  activeNetworkPrinterId: string | null
  scanMaxGapMs: number
  scanMinLength: number
  cameraDeviceId: string | null
  drawerOpenCode: 'pulse2' | 'pulse5'
  lastSuccessfulPrintAt: string | null
  lastPrintError: string | null
  lastProbeAt: string | null
  lastProbeOk: boolean | null
}

export const DEFAULT_HARDWARE_CONFIG: HardwareStationConfig = {
  receiptPrinterName: null,
  labelPrinterName: null,
  receiptTransport: 'usb',
  networkReceiptHost: null,
  networkReceiptPort: 9100,
  networkConnectTimeoutMs: 5000,
  paperWidthChars: 42,
  textEncoding: 'utf8',
  savedNetworkPrinters: [],
  activeNetworkPrinterId: null,
  scanMaxGapMs: 50,
  scanMinLength: 3,
  cameraDeviceId: null,
  drawerOpenCode: 'pulse2',
  lastSuccessfulPrintAt: null,
  lastPrintError: null,
  lastProbeAt: null,
  lastProbeOk: null
}

export type ScanEvent = {
  barcode: string
  source: 'hid-wedge' | 'manual'
  at: string
}

export type PrintStatus = {
  ok: boolean
  message: string
  printerName: string | null
  at: string
  code?: string
}

export type LabelPreview = {
  barcode: string
  title: string | null
  svg: string
  payloadBytes: number
}

export type CameraCapabilities = {
  permissionGranted: boolean
  note: string
  deviceCount?: number
}

export type PrinterProbeResult = {
  ok: boolean
  transport: HardwareTransport
  target: string
  status: 'online' | 'offline' | 'unknown'
  message: string
  code?: string
  at: string
}

export type HardwareDiagnosticsSnapshot = {
  at: string
  printersDetected: number
  usbPrinters: number
  networkTargets: number
  networkReachable: boolean | null
  lastSuccessfulPrintAt: string | null
  lastPrintError: string | null
  lastProbeAt: string | null
  lastProbeOk: boolean | null
  receiptTransport: HardwareTransport
  activeNetworkTarget: string | null
  cameraNote: string
  scanConfigured: boolean
}

export type BackendServiceStatus = {
  platform: NodeJS.Platform
  serviceName: string
  state: 'running' | 'stopped' | 'unknown' | 'unsupported'
  raw: string
  canStart: boolean
  logsHint: string
}

export type UpdateCheckResult = {
  implemented: false
  code: 'NOT_IMPLEMENTED'
  message: string
  currentVersion: string
}

export type FirstRunState = {
  completed: boolean
  path: string
}

/** Stable Main error codes for network/USB print failures. */
export const HardwareErrorCodes = {
  PRINTER_OFFLINE: 'PRINTER_OFFLINE',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  PRINTER_UNAVAILABLE: 'PRINTER_UNAVAILABLE',
  UNKNOWN_DEVICE: 'UNKNOWN_DEVICE',
  PAPER_UNAVAILABLE: 'PAPER_UNAVAILABLE',
  HOST_NOT_CONFIGURED: 'HOST_NOT_CONFIGURED',
  PRINTER_NOT_SELECTED: 'PRINTER_NOT_SELECTED'
} as const

export type HardwareErrorCode = (typeof HardwareErrorCodes)[keyof typeof HardwareErrorCodes]
