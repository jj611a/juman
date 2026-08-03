import * as React from 'react'
import { Link } from 'react-router'
import { Page, PageHeader } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TextInput } from '@/components/ui/text-input'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { InlineMessage } from '@/components/ui/inline-message'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type {
  HardwareStationConfig,
  PaperWidthChars,
  PrintStatus,
  PrinterInfo,
  PrinterProbeResult,
  SavedNetworkPrinter,
  TextEncoding
} from '@shared/hardware'

function newId(): string {
  return crypto.randomUUID()
}

function arabicPrintMessage(status: PrintStatus | PrinterProbeResult): string {
  const code = 'code' in status ? status.code : undefined
  switch (code) {
    case 'CONNECTION_TIMEOUT':
      return 'انتهت مهلة الاتصال بالطابعة'
    case 'CONNECTION_REFUSED':
      return 'رُفض الاتصال — تحقق من العنوان والمنفذ'
    case 'PRINTER_OFFLINE':
      return 'الطابعة غير متصلة أو غير قابلة للوصول'
    case 'PRINTER_UNAVAILABLE':
      return 'الطابعة غير متاحة'
    case 'HOST_NOT_CONFIGURED':
      return 'لم يُضبط عنوان طابعة الشبكة'
    case 'PRINTER_NOT_SELECTED':
      return 'لم تُختر طابعة'
    case 'UNKNOWN_DEVICE':
      return 'جهاز غير معروف'
    default:
      return status.message
  }
}

export default function HardwarePage(): React.ReactElement {
  const canView = usePermission('settings.view')
  const canUpdate = usePermission('settings.update')
  const [config, setConfig] = React.useState<HardwareStationConfig | null>(null)
  const [printers, setPrinters] = React.useState<PrinterInfo[]>([])
  const [status, setStatus] = React.useState<PrintStatus | PrinterProbeResult | null>(null)
  const [backendRaw, setBackendRaw] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [draftHost, setDraftHost] = React.useState('')
  const [draftPort, setDraftPort] = React.useState(9100)
  const [draftName, setDraftName] = React.useState('')

  const refresh = React.useCallback(async () => {
    setError(null)
    try {
      const [cfg, list, svc] = await Promise.all([
        apiClient.hardware.getConfig(),
        apiClient.hardware.listPrinters(),
        apiClient.hardware.backendStatus()
      ])
      setConfig(cfg)
      setPrinters(list)
      setBackendRaw(`${svc.state} — ${svc.serviceName}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل إعدادات الأجهزة')
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function save(patch: Partial<HardwareStationConfig>): Promise<void> {
    if (!canUpdate) return
    setBusy(true)
    try {
      const next = await apiClient.hardware.setConfig(patch)
      setConfig(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ')
    } finally {
      setBusy(false)
    }
  }

  async function runAction(
    action: () => Promise<PrintStatus | PrinterProbeResult>
  ): Promise<void> {
    setBusy(true)
    setStatus(null)
    try {
      setStatus(await action())
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'فشلت العملية',
        printerName: null,
        at: new Date().toISOString()
      })
    } finally {
      setBusy(false)
    }
  }

  async function addNetworkTarget(): Promise<void> {
    if (!config || !canUpdate) return
    const host = draftHost.trim()
    if (!host) {
      setError('أدخل عنوان IP أو اسم المضيف')
      return
    }
    const entry: SavedNetworkPrinter = {
      id: newId(),
      name: draftName.trim() || `${host}:${draftPort || 9100}`,
      host,
      port: draftPort > 0 ? draftPort : 9100
    }
    const list = [...config.savedNetworkPrinters, entry]
    await save({
      savedNetworkPrinters: list,
      activeNetworkPrinterId: entry.id,
      receiptTransport: 'network'
    })
    setDraftHost('')
    setDraftName('')
    setDraftPort(9100)
  }

  async function removeNetworkTarget(id: string): Promise<void> {
    if (!config || !canUpdate) return
    const list = config.savedNetworkPrinters.filter((p) => p.id !== id)
    const active =
      config.activeNetworkPrinterId === id ? list[0]?.id ?? null : config.activeNetworkPrinterId
    await save({ savedNetworkPrinters: list, activeNetworkPrinterId: active })
  }

  if (!canView) {
    return (
      <Page>
        <InlineMessage variant="warning">لا تملك صلاحية عرض الإعدادات</InlineMessage>
      </Page>
    )
  }

  const usbPrinters = printers.filter((p) => p.transport === 'usb')

  return (
    <Page className="animate-juman-in">
      <PageHeader
        title="الأجهزة"
        description="طابعة الإيصال والملصقات والماسح والدرج والكاميرا — إعدادات محطة العمل"
        actions={
          <Button asChild variant="outline">
            <Link to="/hardware/diagnostics">تشخيص الأجهزة</Link>
          </Button>
        }
      />

      {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}
      {status ? (
        <InlineMessage variant={status.ok ? 'success' : 'error'}>
          {arabicPrintMessage(status)}
        </InlineMessage>
      ) : null}

      {!config ? (
        <p className="text-muted-foreground">جاري التحميل…</p>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {!canUpdate ? (
            <InlineMessage variant="info">عرض فقط — يلزم settings.update للتعديل</InlineMessage>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-title">نوع الاتصال</h3>
            <Label>النقل</Label>
            <Select
              value={config.receiptTransport}
              onValueChange={(v) => void save({ receiptTransport: v as 'usb' | 'network' })}
              disabled={busy || !canUpdate}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">USB (Windows spool)</SelectItem>
                <SelectItem value="network">شبكة (TCP ESC/POS)</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">طابعة الإيصال (USB)</h3>
            <Label>الطابعة</Label>
            <Select
              value={config.receiptPrinterName ?? '__none__'}
              onValueChange={(v) =>
                void save({ receiptPrinterName: v === '__none__' ? null : v })
              }
              disabled={busy || !canUpdate}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر طابعة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون —</SelectItem>
                {usbPrinters.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name} ({p.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void runAction(() => apiClient.hardware.testReceipt())}
              >
                طباعة اختبار
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void runAction(() => apiClient.hardware.probePrinter())}
              >
                فحص الاتصال
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
                تحديث القائمة
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">طابعة الملصقات (USB)</h3>
            <Label>الطابعة</Label>
            <Select
              value={config.labelPrinterName ?? '__same__'}
              onValueChange={(v) =>
                void save({ labelPrinterName: v === '__same__' ? null : v })
              }
              disabled={busy || !canUpdate}
            >
              <SelectTrigger>
                <SelectValue placeholder="نفس طابعة الإيصال" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__same__">نفس طابعة الإيصال / الشبكة</SelectItem>
                {usbPrinters.map((p) => (
                  <SelectItem key={`label-${p.name}`} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">طابعات الشبكة (ESC/POS)</h3>
            <p className="text-caption text-muted-foreground">
              TCP/IP — المنفذ الافتراضي 9100. يمكن حفظ عدة أهداف واختيار الافتراضي.
            </p>
            {config.savedNetworkPrinters.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد طابعات شبكة محفوظة.</p>
            ) : (
              <ul className="space-y-2">
                {config.savedNetworkPrinters.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-caption text-muted-foreground dir-ltr" dir="ltr">
                        {p.host}:{p.port}
                        {config.activeNetworkPrinterId === p.id ? ' — افتراضي' : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !canUpdate || config.activeNetworkPrinterId === p.id}
                        onClick={() =>
                          void save({
                            activeNetworkPrinterId: p.id,
                            receiptTransport: 'network'
                          })
                        }
                      >
                        تعيين افتراضي
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy || !canUpdate}
                        onClick={() => void removeNetworkTarget(p.id)}
                      >
                        حذف
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="net-name">الاسم</Label>
                <TextInput
                  id="net-name"
                  value={draftName}
                  disabled={busy || !canUpdate}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="طابعة الصالة"
                />
              </div>
              <div>
                <Label htmlFor="net-host">IP / المضيف</Label>
                <TextInput
                  id="net-host"
                  dir="ltr"
                  value={draftHost}
                  disabled={busy || !canUpdate}
                  onChange={(e) => setDraftHost(e.target.value)}
                  placeholder="192.168.1.50"
                />
              </div>
              <div>
                <Label htmlFor="net-port">المنفذ</Label>
                <NumberInput
                  id="net-port"
                  value={draftPort}
                  disabled={busy || !canUpdate}
                  onChange={(e) => setDraftPort(Number(e.target.value) || 9100)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="net-timeout">مهلة الاتصال (مللي ثانية)</Label>
                <NumberInput
                  id="net-timeout"
                  value={config.networkConnectTimeoutMs}
                  disabled={busy || !canUpdate}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isNaN(n)) void save({ networkConnectTimeoutMs: n })
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !canUpdate}
                onClick={() => void addNetworkTarget()}
              >
                حفظ طابعة شبكة
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || config.receiptTransport !== 'network'}
                onClick={() => void runAction(() => apiClient.hardware.probePrinter())}
              >
                اختبار الاتصال
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || config.receiptTransport !== 'network'}
                onClick={() => void runAction(() => apiClient.hardware.testReceipt())}
              >
                طباعة اختبار شبكة
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">عرض الورق والترميز</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>عرض الورق (حروف)</Label>
                <Select
                  value={String(config.paperWidthChars)}
                  onValueChange={(v) =>
                    void save({ paperWidthChars: Number(v) as PaperWidthChars })
                  }
                  disabled={busy || !canUpdate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="32">32</SelectItem>
                    <SelectItem value="42">42</SelectItem>
                    <SelectItem value="48">48</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ترميز النص</Label>
                <Select
                  value={config.textEncoding}
                  onValueChange={(v) => void save({ textEncoding: v as TextEncoding })}
                  disabled={busy || !canUpdate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utf8">UTF-8</SelectItem>
                    <SelectItem value="windows-1256">Windows-1256 (عربي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">درج النقد</h3>
            <Label>نبضة الفتح</Label>
            <Select
              value={config.drawerOpenCode}
              onValueChange={(v) => void save({ drawerOpenCode: v as 'pulse2' | 'pulse5' })}
              disabled={busy || !canUpdate}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pulse2">Pin 2</SelectItem>
                <SelectItem value="pulse5">Pin 5</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void runAction(() => apiClient.hardware.openDrawer())}
            >
              فتح الدرج
            </Button>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">ماسح الباركود (USB HID)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="scan-gap">أقصى فجوة بين الأحرف (مللي ثانية)</Label>
                <NumberInput
                  id="scan-gap"
                  value={config.scanMaxGapMs}
                  disabled={busy || !canUpdate}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isNaN(n)) void save({ scanMaxGapMs: n })
                  }}
                />
              </div>
              <div>
                <Label htmlFor="scan-min">الحد الأدنى لطول المسح</Label>
                <NumberInput
                  id="scan-min"
                  value={config.scanMinLength}
                  disabled={busy || !canUpdate}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isNaN(n)) void save({ scanMinLength: n })
                  }}
                />
              </div>
            </div>
            <p className="text-caption text-muted-foreground">
              الإدخال اليدوي يبقى متاحاً في حقول المسح. ركّز الحقل تلقائياً أثناء العمل.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-title">الكاميرا</h3>
            <Label htmlFor="cam-id">معرّف الجهاز (اختياري)</Label>
            <TextInput
              id="cam-id"
              dir="ltr"
              value={config.cameraDeviceId ?? ''}
              disabled={busy || !canUpdate}
              onChange={(e) =>
                void save({ cameraDeviceId: e.target.value.trim() || null })
              }
              placeholder="deviceId من المتصفح"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-title">خدمة الخلفية</h3>
            <p className="text-sm text-muted-foreground">{backendRaw || '—'}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void apiClient.hardware.startBackend().then(() => refresh())}
              >
                تشغيل خدمة JumanApi
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void apiClient.hardware.openLogs()}
              >
                فتح مجلد السجلات
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  )
}
