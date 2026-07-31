import * as React from 'react'
import { Button } from '@/components/ui/button'
import { InlineMessage } from '@/components/ui/inline-message'
import type {
  DiagnosticCheckResult,
  DiagnosticLogChunk,
  DiagnosticRepairActionId,
  DiagnosticStatus,
  DiagnosticsRunResult
} from '@shared/diagnostics'

const REPAIR_ACTIONS: Array<{
  id: DiagnosticRepairActionId
  label: string
  confirm: string
}> = [
  {
    id: 'restart_services',
    label: 'إعادة تشغيل الخدمات',
    confirm: 'إعادة تشغيل PostgreSQL و JumanApi؟ قد يُطلب UAC.'
  },
  {
    id: 'restart_postgresql',
    label: 'إعادة تشغيل PostgreSQL',
    confirm: 'إعادة تشغيل خدمة postgresql-x64-16؟'
  },
  {
    id: 'restart_backend',
    label: 'إعادة تشغيل JumanApi',
    confirm: 'إعادة تشغيل خدمة JumanApi؟'
  },
  {
    id: 'repair_services',
    label: 'إصلاح الخدمات',
    confirm: 'تشغيل repair-install.ps1 (ترحيل + WinSW)؟'
  },
  {
    id: 'rerun_migrations',
    label: 'إعادة الترحيلات',
    confirm: 'تشغيل run_api.py migrate عبر .venv؟'
  },
  {
    id: 'repair_acls',
    label: 'إصلاح الصلاحيات',
    confirm: 'تشغيل set-install-acls.ps1؟'
  },
  {
    id: 'repair_config_dirs',
    label: 'إصلاح مجلدات الإعداد',
    confirm: 'إنشاء المجلدات الناقصة وتحديث ACLs؟ (بدون تدوير الأسرار)'
  },
  {
    id: 'test_db_connection',
    label: 'اختبار اتصال قاعدة البيانات',
    confirm: 'تشغيل diagnose --json لاختبار الاتصال؟'
  },
  {
    id: 'open_logs',
    label: 'فتح مجلد السجلات',
    confirm: 'فتح مجلد السجلات في المستكشف؟'
  },
  {
    id: 'open_storage',
    label: 'فتح مجلد التخزين',
    confirm: 'فتح مجلد التخزين في المستكشف؟'
  },
  {
    id: 'open_config',
    label: 'فتح مجلد الإعدادات',
    confirm: 'فتح مجلد الإعدادات في المستكشف؟'
  }
]

function statusColor(status: DiagnosticStatus): string {
  if (status === 'PASS') return 'text-emerald-400'
  if (status === 'WARNING') return 'text-amber-400'
  return 'text-red-400'
}

function statusBadge(status: DiagnosticStatus): string {
  if (status === 'PASS') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
  if (status === 'WARNING') return 'bg-amber-500/15 text-amber-300 border-amber-500/40'
  return 'bg-red-500/15 text-red-300 border-red-500/40'
}

function bridge() {
  if (!window.juman?.diagnostics) {
    throw new Error('Diagnostics bridge unavailable')
  }
  return window.juman.diagnostics
}

export function DiagnosticsPage(): React.ReactElement {
  const [running, setRunning] = React.useState(false)
  const [run, setRun] = React.useState<DiagnosticsRunResult | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [logs, setLogs] = React.useState<DiagnosticLogChunk[]>([])
  const [logSearch, setLogSearch] = React.useState('')
  const [busyRepair, setBusyRepair] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [ipcOk, setIpcOk] = React.useState<boolean | null>(null)
  const autoStarted = React.useRef(false)

  const selected: DiagnosticCheckResult | null =
    run?.checks.find((c) => c.id === selectedId) || run?.checks[0] || null

  const loadLogs = React.useCallback(async () => {
    try {
      setLogs(await bridge().logs())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const runAll = React.useCallback(async () => {
    setRunning(true)
    setError(null)
    setMessage(null)
    try {
      const ping = await bridge().ping()
      setIpcOk(Boolean(ping.pong))
      const result = await bridge().run()
      setRun(result)
      setSelectedId(result.checks[0]?.id ?? null)
      await loadLogs()
    } catch (err) {
      const msg =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.stack || err.message
            : String(err)
      setError(msg)
    } finally {
      setRunning(false)
    }
  }, [loadLogs])

  React.useEffect(() => {
    if (autoStarted.current) return
    autoStarted.current = true
    void runAll()
  }, [runAll])

  const filteredLogText = React.useMemo(() => {
    const q = logSearch.trim().toLowerCase()
    return logs
      .map((chunk) => {
        const header = `===== ${chunk.source} ${chunk.path || ''} ${chunk.truncated ? '(truncated)' : ''} =====\n`
        return header + chunk.content
      })
      .join('\n\n')
      .split('\n')
      .filter((line) => !q || line.toLowerCase().includes(q))
      .join('\n')
  }, [logs, logSearch])

  async function confirmRepair(action: (typeof REPAIR_ACTIONS)[number]): Promise<void> {
    const ok = window.confirm(action.confirm)
    if (!ok) return
    setBusyRepair(action.id)
    setError(null)
    try {
      const result = await bridge().repair(action.id)
      setMessage(
        result.ok
          ? `${action.label}: ${result.message}`
          : `${action.label} فشل: ${result.error || result.message}`
      )
      if (!result.ok && result.error) setError(result.error)
      await runAll()
    } catch (err) {
      setError(err instanceof Error ? err.stack || err.message : String(err))
    } finally {
      setBusyRepair(null)
    }
  }

  async function exportReport(): Promise<void> {
    try {
      const result = await bridge().exportReport()
      if (result.ok) setMessage(`تم حفظ التقرير: ${result.path}`)
      else if (result.error !== 'cancelled') setError(result.error || 'export failed')
    } catch (err) {
      setError(err instanceof Error ? err.stack || err.message : String(err))
    }
  }

  async function copyLogs(): Promise<void> {
    try {
      await navigator.clipboard.writeText(filteredLogText)
      setMessage('تم نسخ السجلات')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      className="flex h-screen min-h-0 flex-col bg-background text-foreground"
      dir="rtl"
      data-theme="juman-dark"
    >
      <header className="flex items-center justify-between border-b border-[var(--brand)]/30 bg-[var(--sidebar)] px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--brand)]">مركز التشخيص والاستعادة</h1>
          <p className="text-xs text-muted-foreground">
            أداة تشغيلية — تفحص كل الأنظمة حتى عند فشل الإقلاع
            {ipcOk != null ? ` · IPC ${ipcOk ? 'OK' : 'FAIL'}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" disabled={running} onClick={() => void runAll()}>
            {running ? 'جاري الفحص…' : 'إعادة الفحص'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportReport()}>
            تصدير ZIP
          </Button>
        </div>
      </header>

      {(error || message) && (
        <div className="space-y-2 px-4 pt-3">
          {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}
          {message ? <InlineMessage variant="info">{message}</InlineMessage> : null}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[280px_1fr_340px]">
        {/* Checks — start side in RTL */}
        <aside className="min-h-0 overflow-auto border-l border-border bg-[var(--sidebar)] p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
            الفحوصات
          </h2>
          <ul className="space-y-1">
            {(run?.checks || []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded-md border px-2 py-2 text-right text-sm transition ${
                    selected?.id === c.id
                      ? 'border-[var(--brand)] bg-[var(--brand-subtle)]'
                      : 'border-transparent hover:bg-secondary'
                  }`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.titleAr}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {c.durationMs} ms · {new Date(c.timestamp).toLocaleTimeString('ar')}
                  </div>
                </button>
              </li>
            ))}
            {!run && running ? (
              <li className="text-sm text-muted-foreground">جاري تشغيل كل الفحوصات…</li>
            ) : null}
          </ul>
        </aside>

        {/* Details */}
        <main className="min-h-0 overflow-auto p-4">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{selected.titleAr}</h2>
                <span className={`rounded border px-2 py-0.5 text-xs ${statusBadge(selected.status)}`}>
                  {selected.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{selected.details}</p>
              {selected.error ? (
                <pre className="overflow-auto rounded-md border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200 whitespace-pre-wrap">
                  {selected.error}
                </pre>
              ) : null}
              <pre className="overflow-auto rounded-md border border-border bg-[var(--panel)] p-3 text-xs text-foreground-secondary whitespace-pre-wrap">
                {JSON.stringify(selected.evidence, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground">اختر فحصاً لعرض التفاصيل.</p>
          )}
        </main>

        {/* Logs */}
        <aside className="flex min-h-0 flex-col border-r border-border bg-[var(--panel)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
              السجلات
            </h2>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => void loadLogs()}>
                تحديث
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void copyLogs()}>
                نسخ
              </Button>
            </div>
          </div>
          <input
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            placeholder="بحث في السجلات…"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
          />
          <pre className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
            {filteredLogText || 'لا سجلات بعد'}
          </pre>
        </aside>
      </div>

      {/* Repair + summary */}
      <footer className="border-t border-[var(--brand)]/30 bg-[var(--sidebar)] p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {REPAIR_ACTIONS.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busyRepair) || running}
              onClick={() => void confirmRepair(a)}
            >
              {busyRepair === a.id ? '…' : a.label}
            </Button>
          ))}
        </div>
        {run?.summary ? (
          <div className="grid gap-2 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">الحالة العامة</div>
              <div className={`font-semibold ${statusColor(run.summary.overallHealth)}`}>
                {run.summary.overallHealth}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">مانع الإقلاع</div>
              <div>{run.summary.startupBlocker || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">الإجراء المقترح</div>
              <div>{run.summary.recommendedFix || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">مستوى الثقة</div>
              <div>
                {run.summary.confidence} · P{run.summary.passCount}/W{run.summary.warningCount}/F
                {run.summary.failCount} · {run.durationMs} ms
              </div>
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
