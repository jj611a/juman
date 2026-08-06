import { existsSync, writeFileSync } from 'node:fs'
import type { BrowserWindow } from 'electron'
import { app, ipcMain, shell } from 'electron'
import { IpcChannels } from '../../shared/channels'
import type {
  CameraCapabilities,
  FirstRunState,
  HardwareDiagnosticsSnapshot,
  HardwareStationConfig,
  PrinterProbeResult,
  PrintStatus,
  UpdateCheckResult
} from '../../shared/hardware'
import {
  loadHardwareConfig,
  recordPrintOutcome,
  recordProbeOutcome,
  saveHardwareConfig
} from './configStore'
import { openCashDrawer } from './drawer'
import { installCameraPermissionHandler } from './camera/permissions'
import { previewLabel as buildLabelPreview, printLabel as sendLabelPrint } from './printers/label'
import { listNetworkPrinterTargets, probeNetworkPrinter } from './printers/network'
import { resolveActiveNetworkTarget } from './printers/printService'
import { testReceiptPrint } from './printers/receipt'
import { listUsbPrinters } from './printers/usb'
import { ScanGapDetector } from './scanner/hidWedge'
import {
  firstRunFlagPath,
  getBackendServiceStatus,
  installLogsHint,
  patchJumanEnv,
  readJumanEnv,
  repairBackendService,
  restartBackendService,
  startBackendService,
  stopBackendService
} from './serviceStatus'

function trackPrint(result: PrintStatus): PrintStatus {
  recordPrintOutcome(result.ok, result.message, result.at)
  return result
}

export function createHardwareController(getMainWindow: () => BrowserWindow | null) {
  installCameraPermissionHandler()

  let config = loadHardwareConfig()
  const detector = new ScanGapDetector({
    maxGapMs: config.scanMaxGapMs,
    minLength: config.scanMinLength
  })

  function broadcastScan(barcode: string): void {
    const win = getMainWindow()
    win?.webContents.send(IpcChannels.HARDWARE_SCAN_EVENT, {
      barcode,
      source: 'hid-wedge' as const,
      at: new Date().toISOString()
    })
  }

  function attachInputListener(win: BrowserWindow): void {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return
      const key = input.key
      const completed = detector.push(key === 'Enter' ? 'Enter' : key.length === 1 ? key : '')
      if (completed) broadcastScan(completed)
    })
  }

  return {
    attachToWindow(win: BrowserWindow): void {
      attachInputListener(win)
    },

    getConfig(): HardwareStationConfig {
      config = loadHardwareConfig()
      detector.setOptions({
        maxGapMs: config.scanMaxGapMs,
        minLength: config.scanMinLength
      })
      return config
    },

    setConfig(patch: Partial<HardwareStationConfig>): HardwareStationConfig {
      config = saveHardwareConfig(patch)
      detector.setOptions({
        maxGapMs: config.scanMaxGapMs,
        minLength: config.scanMinLength
      })
      return config
    },

    async listPrinters() {
      config = this.getConfig()
      const usb = await listUsbPrinters()
      const net = await listNetworkPrinterTargets(
        config.savedNetworkPrinters,
        config.activeNetworkPrinterId,
        config.networkConnectTimeoutMs,
        false
      )
      return [...usb, ...net]
    },

    async probePrinter(): Promise<PrinterProbeResult> {
      config = this.getConfig()
      const at = new Date().toISOString()

      if (config.receiptTransport === 'network') {
        const target = resolveActiveNetworkTarget(config)
        if (!target?.host) {
          const result: PrinterProbeResult = {
            ok: false,
            transport: 'network',
            target: '',
            status: 'offline',
            message: 'Network printer host not configured',
            code: 'HOST_NOT_CONFIGURED',
            at
          }
          recordProbeOutcome(false, at)
          return result
        }
        const probe = await probeNetworkPrinter(
          target.host,
          target.port,
          config.networkConnectTimeoutMs
        )
        recordProbeOutcome(probe.ok, at)
        return {
          ok: probe.ok,
          transport: 'network',
          target: `${target.host}:${target.port}`,
          status: probe.status,
          message: probe.message,
          code: probe.code,
          at
        }
      }

      const name = config.receiptPrinterName
      if (!name) {
        const result: PrinterProbeResult = {
          ok: false,
          transport: 'usb',
          target: '',
          status: 'unknown',
          message: 'Receipt printer not selected',
          code: 'PRINTER_NOT_SELECTED',
          at
        }
        recordProbeOutcome(false, at)
        return result
      }
      const usb = await listUsbPrinters()
      const found = usb.find((p) => p.name === name)
      const online = Boolean(found) && found?.status !== 'offline'
      recordProbeOutcome(online, at)
      return {
        ok: online,
        transport: 'usb',
        target: name,
        status: online ? 'online' : found ? 'offline' : 'unknown',
        message: online
          ? 'USB printer detected'
          : found
            ? 'USB printer offline'
            : 'USB printer not found',
        code: online ? undefined : 'PRINTER_UNAVAILABLE',
        at
      }
    },

    async diagnostics(): Promise<HardwareDiagnosticsSnapshot> {
      config = this.getConfig()
      const usb = await listUsbPrinters()
      const net = await listNetworkPrinterTargets(
        config.savedNetworkPrinters,
        config.activeNetworkPrinterId,
        config.networkConnectTimeoutMs,
        false
      )
      const active = resolveActiveNetworkTarget(config)
      let networkReachable: boolean | null = null
      if (config.receiptTransport === 'network' && active?.host) {
        const probe = await probeNetworkPrinter(
          active.host,
          active.port,
          config.networkConnectTimeoutMs
        )
        networkReachable = probe.ok
        recordProbeOutcome(probe.ok)
        config = loadHardwareConfig()
      }

      return {
        at: new Date().toISOString(),
        printersDetected: usb.length + net.length,
        usbPrinters: usb.length,
        networkTargets: net.length,
        networkReachable,
        lastSuccessfulPrintAt: config.lastSuccessfulPrintAt,
        lastPrintError: config.lastPrintError,
        lastProbeAt: config.lastProbeAt,
        lastProbeOk: config.lastProbeOk,
        receiptTransport: config.receiptTransport,
        activeNetworkTarget: active ? `${active.host}:${active.port}` : null,
        cameraNote: config.cameraDeviceId
          ? `Configured deviceId=${config.cameraDeviceId}`
          : 'No cameraDeviceId set — renderer uses default device',
        scanConfigured: config.scanMinLength > 0 && config.scanMaxGapMs > 0
      }
    },

    async testReceipt() {
      const result = await testReceiptPrint(this.getConfig())
      return trackPrint(result)
    },

    previewLabel(barcode: string, title?: string | null) {
      return buildLabelPreview(barcode, title)
    },

    async printLabel(barcode: string, title?: string | null) {
      const result = await sendLabelPrint(this.getConfig(), barcode, title)
      return trackPrint(result)
    },

    async openDrawer() {
      const result = await openCashDrawer(this.getConfig())
      return trackPrint(result)
    },

    cameraCapabilities(): CameraCapabilities {
      return {
        permissionGranted: true,
        note: 'Camera preview runs in the renderer via getUserMedia; Main grants media permission.',
        deviceCount: undefined
      }
    },

    backendStatus: getBackendServiceStatus,
    startBackend: startBackendService,
    stopBackend: stopBackendService,
    restartBackend: restartBackendService,
    repairBackend: repairBackendService,
    readEnv: readJumanEnv,
    patchEnv: patchJumanEnv,

    openLogsFolder(): boolean {
      void shell.openPath(installLogsHint())
      return true
    },

    getFirstRunState(): FirstRunState {
      const path = firstRunFlagPath()
      return { completed: existsSync(path), path }
    },

    completeFirstRun(): FirstRunState {
      const path = firstRunFlagPath()
      writeFileSync(path, new Date().toISOString(), 'utf8')
      return { completed: true, path }
    },

    checkUpdates(): UpdateCheckResult {
      return {
        implemented: false,
        code: 'NOT_IMPLEMENTED',
        message: 'Cloud updates are not implemented yet',
        currentVersion: app.getVersion()
      }
    }
  }
}

export type HardwareController = ReturnType<typeof createHardwareController>

export function registerHardwareIpc(hw: HardwareController): void {
  ipcMain.handle(IpcChannels.HARDWARE_GET_CONFIG, async () => ({ ok: true, data: hw.getConfig() }))
  ipcMain.handle(IpcChannels.HARDWARE_SET_CONFIG, async (_e, patch: Partial<HardwareStationConfig>) => ({
    ok: true,
    data: hw.setConfig(patch ?? {})
  }))
  ipcMain.handle(IpcChannels.HARDWARE_PRINTERS_LIST, async () => ({
    ok: true,
    data: await hw.listPrinters()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_PRINTER_PROBE, async () => ({
    ok: true,
    data: await hw.probePrinter()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_DIAGNOSTICS, async () => ({
    ok: true,
    data: await hw.diagnostics()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_RECEIPT_TEST, async () => ({
    ok: true,
    data: await hw.testReceipt()
  }))
  ipcMain.handle(
    IpcChannels.HARDWARE_LABEL_PREVIEW,
    async (_e, payload: { barcode: string; title?: string | null }) => ({
      ok: true,
      data: hw.previewLabel(payload?.barcode ?? '', payload?.title)
    })
  )
  ipcMain.handle(
    IpcChannels.HARDWARE_LABEL_PRINT,
    async (_e, payload: { barcode: string; title?: string | null }) => ({
      ok: true,
      data: await hw.printLabel(payload?.barcode ?? '', payload?.title)
    })
  )
  ipcMain.handle(IpcChannels.HARDWARE_DRAWER_OPEN, async () => ({
    ok: true,
    data: await hw.openDrawer()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_CAMERA_CAPABILITIES, async () => ({
    ok: true,
    data: hw.cameraCapabilities()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_BACKEND_STATUS, async () => ({
    ok: true,
    data: await hw.backendStatus()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_BACKEND_START, async () => ({
    ok: true,
    data: await hw.startBackend()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_BACKEND_STOP, async () => ({
    ok: true,
    data: await hw.stopBackend()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_BACKEND_RESTART, async () => ({
    ok: true,
    data: await hw.restartBackend()
  }))
  ipcMain.handle(IpcChannels.HARDWARE_BACKEND_REPAIR, async () => ({
    ok: true,
    data: await hw.repairBackend()
  }))
  ipcMain.handle(IpcChannels.APP_READ_ENV, async () => ({
    ok: true,
    data: hw.readEnv()
  }))
  ipcMain.handle(IpcChannels.APP_PATCH_ENV, async (_e, updates: Record<string, string>) => ({
    ok: true,
    data: hw.patchEnv(updates ?? {})
  }))
  ipcMain.handle(IpcChannels.HARDWARE_OPEN_LOGS, async () => ({
    ok: true,
    data: hw.openLogsFolder()
  }))
  ipcMain.handle(IpcChannels.APP_FIRST_RUN_STATE, async () => ({
    ok: true,
    data: hw.getFirstRunState()
  }))
  ipcMain.handle(IpcChannels.APP_FIRST_RUN_COMPLETE, async () => ({
    ok: true,
    data: hw.completeFirstRun()
  }))
  ipcMain.handle(IpcChannels.APP_UPDATES_CHECK, async () => ({
    ok: true,
    data: hw.checkUpdates()
  }))
}
