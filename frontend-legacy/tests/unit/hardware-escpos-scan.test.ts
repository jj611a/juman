import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { DEFAULT_HARDWARE_CONFIG, type HardwareStationConfig } from '../../electron/shared/hardware'
import { normalizeHardwareConfig } from '../../electron/main/hardware/configNormalize'
import {
  buildTestReceipt,
  encodeEscposText,
  wrapEscposLines
} from '../../electron/main/hardware/printers/escpos'
import { ScanGapDetector } from '../../electron/main/hardware/scanner/hidWedge'

describe('ScanGapDetector', () => {
  it('emits barcode after fast keys + Enter', () => {
    const d = new ScanGapDetector({ maxGapMs: 50, minLength: 3 })
    const t0 = 1000
    expect(d.push('A', t0)).toBeNull()
    expect(d.push('B', t0 + 10)).toBeNull()
    expect(d.push('C', t0 + 20)).toBeNull()
    expect(d.push('Enter', t0 + 30)).toBe('ABC')
  })

  it('resets when gap exceeds max', () => {
    const d = new ScanGapDetector({ maxGapMs: 50, minLength: 2 })
    const t0 = 1000
    d.push('A', t0)
    d.push('B', t0 + 200)
    expect(d.push('Enter', t0 + 210)).toBeNull()
  })
})

describe('ESC/POS builders', () => {
  it('wraps lines to paper width', () => {
    expect(wrapEscposLines('ABCDEFGHIJ', 4)).toEqual(['ABCD', 'EFGH', 'IJ'])
  })

  it('encodes windows-1256', () => {
    const buf = encodeEscposText('اختبار', 'windows-1256')
    expect(buf.length).toBeGreaterThan(1)
    expect(buf[buf.length - 1]).toBe(0x0a)
  })

  it('builds test receipt with options', () => {
    expect(
      buildTestReceipt('Juman', { encoding: 'utf8', paperWidthChars: 32 }).length
    ).toBeGreaterThan(10)
  })
})

describe('normalizeHardwareConfig', () => {
  it('migrates legacy host into savedNetworkPrinters', () => {
    const next = normalizeHardwareConfig({
      networkReceiptHost: '10.0.0.5',
      networkReceiptPort: 9100
    })
    expect(next.savedNetworkPrinters).toHaveLength(1)
    expect(next.savedNetworkPrinters[0].host).toBe('10.0.0.5')
    expect(next.activeNetworkPrinterId).toBe(next.savedNetworkPrinters[0].id)
    expect(next.networkReceiptHost).toBe('10.0.0.5')
  })

  it('clamps timeout and defaults encoding/width', () => {
    const next = normalizeHardwareConfig({
      networkConnectTimeoutMs: 10,
      paperWidthChars: 99 as never,
      textEncoding: 'latin1' as never
    })
    expect(next.networkConnectTimeoutMs).toBe(500)
    expect(next.paperWidthChars).toBe(42)
    expect(next.textEncoding).toBe('utf8')
  })

  it('syncs active saved target to host/port', () => {
    const next = normalizeHardwareConfig({
      savedNetworkPrinters: [
        { id: 'a', name: 'A', host: '1.1.1.1', port: 9100 },
        { id: 'b', name: 'B', host: '2.2.2.2', port: 9101 }
      ],
      activeNetworkPrinterId: 'b'
    })
    expect(next.networkReceiptHost).toBe('2.2.2.2')
    expect(next.networkReceiptPort).toBe(9101)
  })
})

describe('network TCP send', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('maps ECONNREFUSED to CONNECTION_REFUSED', async () => {
    vi.resetModules()
    class FakeSocket extends EventEmitter {
      setTimeout(): void {}
      destroy(): void {}
      end(cb?: () => void): void {
        cb?.()
      }
      write(_data: Buffer, cb?: (err?: Error | null) => void): boolean {
        cb?.()
        return true
      }
      connect(_port: number, _host: string, cb?: () => void): void {
        queueMicrotask(() => {
          const err = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
          this.emit('error', err)
        })
        void cb
      }
    }
    vi.doMock('node:net', () => ({
      default: { Socket: FakeSocket }
    }))
    const { sendRawToNetworkPrinter, NetworkPrintError } = await import(
      '../../electron/main/hardware/printers/network'
    )
    await expect(sendRawToNetworkPrinter('127.0.0.1', 9100, Buffer.from('x'), 1000)).rejects.toMatchObject({
      code: 'CONNECTION_REFUSED'
    })
    expect(NetworkPrintError).toBeDefined()
  })

  it('succeeds when connect + write complete', async () => {
    vi.resetModules()
    class FakeSocket extends EventEmitter {
      setTimeout(): void {}
      destroy(): void {}
      end(cb?: () => void): void {
        cb?.()
      }
      write(_data: Buffer, cb?: (err?: Error | null) => void): boolean {
        cb?.(null)
        return true
      }
      connect(_port: number, _host: string, cb?: () => void): void {
        queueMicrotask(() => cb?.())
      }
    }
    vi.doMock('node:net', () => ({
      default: { Socket: FakeSocket }
    }))
    const { sendRawToNetworkPrinter } = await import(
      '../../electron/main/hardware/printers/network'
    )
    await expect(
      sendRawToNetworkPrinter('192.168.1.10', 9100, Buffer.from('hello'), 2000)
    ).resolves.toBeUndefined()
  })

  it('probe returns offline on timeout', async () => {
    vi.resetModules()
    class FakeSocket extends EventEmitter {
      setTimeout(): void {}
      destroy(): void {}
      end(): void {}
      write(): boolean {
        return true
      }
      connect(): void {
        queueMicrotask(() => this.emit('timeout'))
      }
    }
    vi.doMock('node:net', () => ({
      default: { Socket: FakeSocket }
    }))
    const { probeNetworkPrinter } = await import(
      '../../electron/main/hardware/printers/network'
    )
    const result = await probeNetworkPrinter('10.0.0.1', 9100, 500)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('offline')
    expect(result.code).toBe('CONNECTION_TIMEOUT')
  })
})

describe('PrintService routing', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes network receipt through TCP', async () => {
    const sendNet = vi.fn().mockResolvedValue(undefined)
    const sendUsb = vi.fn().mockResolvedValue(undefined)
    vi.doMock('../../electron/main/hardware/printers/network', () => ({
      sendRawToNetworkPrinter: sendNet,
      NetworkPrintError: class extends Error {
        code = 'X'
      }
    }))
    vi.doMock('../../electron/main/hardware/printers/usb', () => ({
      sendRawToUsbPrinter: sendUsb
    }))
    const { sendRaw } = await import('../../electron/main/hardware/printers/printService')
    const config: HardwareStationConfig = {
      ...DEFAULT_HARDWARE_CONFIG,
      receiptTransport: 'network',
      networkReceiptHost: '10.0.0.8',
      networkReceiptPort: 9100,
      savedNetworkPrinters: [{ id: '1', name: 'N', host: '10.0.0.8', port: 9100 }],
      activeNetworkPrinterId: '1'
    }
    const result = await sendRaw(config, 'receipt', Buffer.from('job'))
    expect(result.ok).toBe(true)
    expect(sendNet).toHaveBeenCalled()
    expect(sendUsb).not.toHaveBeenCalled()
  })

  it('routes USB when transport is usb', async () => {
    const sendNet = vi.fn().mockResolvedValue(undefined)
    const sendUsb = vi.fn().mockResolvedValue(undefined)
    vi.doMock('../../electron/main/hardware/printers/network', () => ({
      sendRawToNetworkPrinter: sendNet,
      NetworkPrintError: class extends Error {
        code = 'X'
      }
    }))
    vi.doMock('../../electron/main/hardware/printers/usb', () => ({
      sendRawToUsbPrinter: sendUsb
    }))
    const { sendRaw } = await import('../../electron/main/hardware/printers/printService')
    const config: HardwareStationConfig = {
      ...DEFAULT_HARDWARE_CONFIG,
      receiptTransport: 'usb',
      receiptPrinterName: 'EPSON'
    }
    const result = await sendRaw(config, 'receipt', Buffer.from('job'))
    expect(result.ok).toBe(true)
    expect(sendUsb).toHaveBeenCalledWith('EPSON', expect.any(Buffer))
    expect(sendNet).not.toHaveBeenCalled()
  })

  it('returns HOST_NOT_CONFIGURED when network missing host', async () => {
    vi.doMock('../../electron/main/hardware/printers/network', () => ({
      sendRawToNetworkPrinter: vi.fn(),
      NetworkPrintError: class extends Error {
        code = 'X'
      }
    }))
    vi.doMock('../../electron/main/hardware/printers/usb', () => ({
      sendRawToUsbPrinter: vi.fn()
    }))
    const { sendRaw } = await import('../../electron/main/hardware/printers/printService')
    const config: HardwareStationConfig = {
      ...DEFAULT_HARDWARE_CONFIG,
      receiptTransport: 'network',
      networkReceiptHost: null,
      savedNetworkPrinters: [],
      activeNetworkPrinterId: null
    }
    const result = await sendRaw(config, 'receipt', Buffer.from('x'))
    expect(result.ok).toBe(false)
    expect(result.code).toBe('HOST_NOT_CONFIGURED')
  })
})
