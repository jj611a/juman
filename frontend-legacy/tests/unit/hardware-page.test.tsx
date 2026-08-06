import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { DEFAULT_HARDWARE_CONFIG } from '@shared/hardware'
import { useAuthStore } from '@/stores/authStore'

const getConfig = vi.fn()
const setConfig = vi.fn()
const listPrinters = vi.fn()
const testReceipt = vi.fn()
const probePrinter = vi.fn()
const diagnostics = vi.fn()
const backendStatus = vi.fn()
const onScan = vi.fn(() => () => undefined)
const openDrawer = vi.fn()
const printLabel = vi.fn()
const cameraCapabilities = vi.fn()

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    hardware: {
      getConfig: (...args: unknown[]) => getConfig(...args),
      setConfig: (...args: unknown[]) => setConfig(...args),
      listPrinters: (...args: unknown[]) => listPrinters(...args),
      testReceipt: (...args: unknown[]) => testReceipt(...args),
      probePrinter: (...args: unknown[]) => probePrinter(...args),
      diagnostics: (...args: unknown[]) => diagnostics(...args),
      backendStatus: (...args: unknown[]) => backendStatus(...args),
      onScan: (...args: unknown[]) => onScan(...args),
      openDrawer: (...args: unknown[]) => openDrawer(...args),
      printLabel: (...args: unknown[]) => printLabel(...args),
      cameraCapabilities: (...args: unknown[]) => cameraCapabilities(...args),
      startBackend: vi.fn(),
      openLogs: vi.fn()
    }
  }
}))

vi.mock('@/hooks/usePermission', () => ({
  usePermission: (perm: string) => {
    const session = useAuthStore.getState().session
    return Boolean(session?.permissions?.includes(perm))
  }
}))

import HardwarePage from '@/features/hardware/pages/HardwarePage'
import HardwareDiagnosticsPage from '@/features/hardware/pages/HardwareDiagnosticsPage'

function withRouter(ui: React.ReactElement): React.ReactElement {
  return <MemoryRouter>{ui}</MemoryRouter>
}

describe('HardwarePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: {
        authenticated: true,
        user: { id: '1', username: 'admin', full_name: 'Admin', must_change_password: false },
        permissions: ['settings.view', 'settings.update'],
        roles: ['admin']
      } as never
    })
    getConfig.mockResolvedValue({
      ...DEFAULT_HARDWARE_CONFIG,
      receiptTransport: 'usb',
      savedNetworkPrinters: []
    })
    listPrinters.mockResolvedValue([
      { name: 'EPSON', isDefault: true, status: 'idle', transport: 'usb' }
    ])
    backendStatus.mockResolvedValue({
      platform: 'win32',
      serviceName: 'JumanApi',
      state: 'running',
      raw: 'RUNNING',
      canStart: false,
      logsHint: 'C:\\logs'
    })
    setConfig.mockImplementation(async (patch: Record<string, unknown>) => ({
      ...DEFAULT_HARDWARE_CONFIG,
      ...patch
    }))
    testReceipt.mockResolvedValue({
      ok: true,
      message: 'Print job sent',
      printerName: 'EPSON',
      at: new Date().toISOString()
    })
    probePrinter.mockResolvedValue({
      ok: true,
      transport: 'usb',
      target: 'EPSON',
      status: 'online',
      message: 'USB printer detected',
      at: new Date().toISOString()
    })
  })

  it('renders transport and network sections', async () => {
    render(withRouter(<HardwarePage />))
    expect(await screen.findByText('الأجهزة')).toBeInTheDocument()
    expect(screen.getByText('نوع الاتصال')).toBeInTheDocument()
    expect(screen.getByText(/طابعات الشبكة/)).toBeInTheDocument()
    expect(screen.queryByText(/قريبًا/)).not.toBeInTheDocument()
  })

  it('hides save when settings.update missing', async () => {
    useAuthStore.setState({
      session: {
        authenticated: true,
        user: { id: '1', username: 'op', full_name: 'Op', must_change_password: false },
        permissions: ['settings.view'],
        roles: ['cashier']
      } as never
    })
    render(withRouter(<HardwarePage />))
    expect(await screen.findByText(/عرض فقط/)).toBeInTheDocument()
  })

  it('runs receipt test', async () => {
    const user = userEvent.setup()
    render(withRouter(<HardwarePage />))
    await screen.findByText('الأجهزة')
    await user.click(screen.getByRole('button', { name: 'طباعة اختبار' }))
    await waitFor(() => expect(testReceipt).toHaveBeenCalled())
  })
})

describe('HardwareDiagnosticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: {
        authenticated: true,
        user: { id: '1', username: 'admin', full_name: 'Admin', must_change_password: false },
        permissions: ['settings.view'],
        roles: ['admin']
      } as never
    })
    diagnostics.mockResolvedValue({
      at: new Date().toISOString(),
      printersDetected: 1,
      usbPrinters: 1,
      networkTargets: 0,
      networkReachable: null,
      lastSuccessfulPrintAt: null,
      lastPrintError: null,
      lastProbeAt: null,
      lastProbeOk: null,
      receiptTransport: 'usb',
      activeNetworkTarget: null,
      cameraNote: 'No cameraDeviceId set',
      scanConfigured: true
    })
    onScan.mockReturnValue(() => undefined)
    cameraCapabilities.mockResolvedValue({ permissionGranted: true, note: 'ok' })
    getConfig.mockResolvedValue({ ...DEFAULT_HARDWARE_CONFIG })
  })

  it('renders checklist and snapshot', async () => {
    render(withRouter(<HardwareDiagnosticsPage />))
    expect(await screen.findByText('تشخيص الأجهزة')).toBeInTheDocument()
    expect(screen.getAllByText('ماسح الباركود')[0]).toBeInTheDocument()
    expect(screen.getAllByText('طابعة الإيصال')[0]).toBeInTheDocument()
    expect(await screen.findByText('ملخص المحطة')).toBeInTheDocument()
  })
})
