import * as React from 'react'
import { Link } from 'react-router'
import { Page, PageHeader } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { InlineMessage } from '@/components/ui/inline-message'
import { TextInput } from '@/components/ui/text-input'
import { Label } from '@/components/ui/label'
import { CameraCapture } from '@/components/ui/camera-capture'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type {
  HardwareDiagnosticsSnapshot,
  PrintStatus,
  PrinterProbeResult
} from '@shared/hardware'

type CheckId = 'barcode' | 'receipt' | 'label' | 'network' | 'camera'

type CheckResult = {
  id: CheckId
  label: string
  status: 'idle' | 'running' | 'pass' | 'fail' | 'skip'
  detail?: string
}

const INITIAL: CheckResult[] = [
  { id: 'barcode', label: 'ماسح الباركود', status: 'idle' },
  { id: 'receipt', label: 'طابعة الإيصال', status: 'idle' },
  { id: 'label', label: 'طابعة الملصقات', status: 'idle' },
  { id: 'network', label: 'طابعة الشبكة', status: 'idle' },
  { id: 'camera', label: 'الكاميرا', status: 'idle' }
]

function statusLabel(s: CheckResult['status']): string {
  switch (s) {
    case 'pass':
      return 'نجاح'
    case 'fail':
      return 'فشل'
    case 'running':
      return 'جارٍ…'
    case 'skip':
      return 'تخطي'
    default:
      return '—'
  }
}

export default function HardwareDiagnosticsPage(): React.ReactElement {
  const canView = usePermission('settings.view')
  const [snapshot, setSnapshot] = React.useState<HardwareDiagnosticsSnapshot | null>(null)
  const [checks, setChecks] = React.useState<CheckResult[]>(INITIAL)
  const [error, setError] = React.useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [cameraDevices, setCameraDevices] = React.useState<MediaDeviceInfo[]>([])

  const setCheck = React.useCallback((id: CheckId, patch: Partial<CheckResult>) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const loadSnapshot = React.useCallback(async () => {
    setError(null)
    try {
      setSnapshot(await apiClient.hardware.diagnostics())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل التشخيص')
    }
  }, [])

  React.useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  React.useEffect(() => {
    return apiClient.hardware.onScan((event) => {
      setCheck('barcode', {
        status: 'pass',
        detail: `HID: ${event.barcode}`
      })
    })
  }, [setCheck])

  React.useEffect(() => {
    void (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setCameraDevices(devices.filter((d) => d.kind === 'videoinput'))
      } catch {
        setCameraDevices([])
      }
    })()
  }, [])

  async function runPrintCheck(
    id: 'receipt' | 'label',
    action: () => Promise<PrintStatus>
  ): Promise<void> {
    setCheck(id, { status: 'running', detail: undefined })
    setBusy(true)
    try {
      const result = await action()
      setCheck(id, {
        status: result.ok ? 'pass' : 'fail',
        detail: result.message
      })
      await loadSnapshot()
    } catch (err) {
      setCheck(id, {
        status: 'fail',
        detail: err instanceof Error ? err.message : 'فشل'
      })
    } finally {
      setBusy(false)
    }
  }

  async function runNetworkProbe(): Promise<void> {
    setCheck('network', { status: 'running', detail: undefined })
    setBusy(true)
    try {
      const result: PrinterProbeResult = await apiClient.hardware.probePrinter()
      const cfg = await apiClient.hardware.getConfig()
      if (cfg.receiptTransport !== 'network') {
        setCheck('network', {
          status: 'skip',
          detail: 'النقل الحالي USB — غيّر إلى شبكة لاختبار TCP'
        })
      } else {
        setCheck('network', {
          status: result.ok ? 'pass' : 'fail',
          detail: `${result.target || '—'} — ${result.message}`
        })
      }
      await loadSnapshot()
    } catch (err) {
      setCheck('network', {
        status: 'fail',
        detail: err instanceof Error ? err.message : 'فشل الفحص'
      })
    } finally {
      setBusy(false)
    }
  }

  function submitManualBarcode(): void {
    const code = manualBarcode.trim()
    if (!code) {
      setCheck('barcode', { status: 'fail', detail: 'أدخل باركود يدوياً أو امسح' })
      return
    }
    setCheck('barcode', { status: 'pass', detail: `يدوي: ${code}` })
    setManualBarcode('')
  }

  if (!canView) {
    return (
      <Page>
        <InlineMessage variant="warning">لا تملك صلاحية عرض التشخيص</InlineMessage>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="تشخيص الأجهزة"
        description="اختبارات نجاح/فشل للطابعات والماسح والكاميرا"
        actions={
          <Button asChild variant="outline">
            <Link to="/hardware">إعدادات الأجهزة</Link>
          </Button>
        }
      />

      {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <section className="space-y-2">
          <h3 className="text-title">ملخص المحطة</h3>
          {!snapshot ? (
            <p className="text-muted-foreground">جاري التحميل…</p>
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">طابعات مكتشفة</dt>
                <dd>{snapshot.printersDetected}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">USB / شبكة</dt>
                <dd>
                  {snapshot.usbPrinters} / {snapshot.networkTargets}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">النقل</dt>
                <dd>{snapshot.receiptTransport}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">هدف الشبكة</dt>
                <dd dir="ltr">{snapshot.activeNetworkTarget ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">الشبكة قابلة للوصول</dt>
                <dd>
                  {snapshot.networkReachable === null
                    ? '—'
                    : snapshot.networkReachable
                      ? 'نعم'
                      : 'لا'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">آخر طباعة ناجحة</dt>
                <dd dir="ltr">{snapshot.lastSuccessfulPrintAt ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">آخر خطأ</dt>
                <dd>{snapshot.lastPrintError ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">الكاميرا</dt>
                <dd>{snapshot.cameraNote}</dd>
              </div>
            </dl>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => void loadSnapshot()}>
            تحديث الملخص
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="text-title">نتائج الاختبار</h3>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"
              >
                <div>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-caption text-muted-foreground">{c.detail ?? '—'}</div>
                </div>
                <span className="text-sm">{statusLabel(c.status)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-title">ماسح الباركود</h3>
          <p className="text-caption text-muted-foreground">
            امسح باركوداً عبر HID أو أدخل يدوياً. الاختبار ينتظر حدث مسح واحد.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="diag-barcode">إدخال يدوي</Label>
              <TextInput
                id="diag-barcode"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManualBarcode()
                }}
              />
            </div>
            <Button type="button" onClick={submitManualBarcode}>
              تأكيد
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCheck('barcode', { status: 'idle', detail: 'بانتظار المسح…' })
              }
            >
              إعادة تعيين
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-title">الطابعات</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void runPrintCheck('receipt', () => apiClient.hardware.testReceipt())
              }
            >
              اختبار إيصال
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void runPrintCheck('label', () =>
                  apiClient.hardware.printLabel({ barcode: 'DIAG-TEST', title: 'Juman' })
                )
              }
            >
              اختبار ملصق
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void runNetworkProbe()}>
              فحص شبكة
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-title">الكاميرا</h3>
          {cameraDevices.length > 0 ? (
            <ul className="text-caption text-muted-foreground">
              {cameraDevices.map((d) => (
                <li key={d.deviceId} dir="ltr">
                  {d.label || d.deviceId}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-muted-foreground">لا أجهزة فيديو مكتشفة بعد.</p>
          )}
          <CameraCapture
            onCapture={async () => {
              setCheck('camera', { status: 'pass', detail: 'تم التقاط صورة' })
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCheck('camera', { status: 'skip', detail: 'تخطي يدوي' })}
          >
            تخطي الكاميرا
          </Button>
        </section>
      </div>
    </Page>
  )
}
