import type {
  DiagnosticCheckResult,
  DiagnosticStatus,
  DiagnosticsRunResult,
  DiagnosticsSummary
} from '../../shared/diagnostics'
import { ALL_CHECKS } from './checks'
import { nowIso, clearDiagnoseCache } from './util'

function summarize(checks: DiagnosticCheckResult[]): DiagnosticsSummary {
  const passCount = checks.filter((c) => c.status === 'PASS').length
  const warningCount = checks.filter((c) => c.status === 'WARNING').length
  const failCount = checks.filter((c) => c.status === 'FAIL').length

  let overallHealth: DiagnosticStatus = 'PASS'
  if (failCount > 0) overallHealth = 'FAIL'
  else if (warningCount > 0) overallHealth = 'WARNING'

  const blockers = checks.filter((c) => c.status === 'FAIL')
  const startupBlocker =
    blockers[0]?.titleAr || blockers[0]?.title || (failCount ? 'Unknown failure' : null)

  const recommendedFix = (() => {
    const ids = new Set(blockers.map((b) => b.id))
    if (ids.has('postgresql')) {
      return 'تأكد من تثبيت/تشغيل postgresql-x64-16 ثم أعد تشغيل الخدمات من مركز الإصلاح'
    }
    if (ids.has('backend') || ids.has('electron_backend')) {
      return 'شغّل خدمة JumanApi (UAC) أو نفّذ إصلاح الخدمات'
    }
    if (ids.has('configuration')) {
      return 'تحقق من config\\juman.env والمفاتيح المطلوبة'
    }
    if (ids.has('database') || ids.has('alembic')) {
      return 'اختبر اتصال قاعدة البيانات ثم أعد تشغيل الترحيلات (migrate)'
    }
    if (ids.has('filesystem') || ids.has('permissions')) {
      return 'أصلح صلاحيات المجلدات (ACLs) وتأكد من المساحة الحرة'
    }
    if (ids.has('ports')) {
      return 'حرّر منفذ الخادم أو غيّر PORT في juman.env'
    }
    if (warningCount > 0) return 'راجع التحذيرات؛ التشغيل قد ينجح مع قيود'
    return 'النظام سليم — لا إجراء مطلوب'
  })()

  const confidence: DiagnosticsSummary['confidence'] =
    failCount === 0 && warningCount === 0
      ? 'high'
      : failCount > 0 && blockers.every((b) => Boolean(b.error || b.evidence))
        ? 'high'
        : failCount > 2
          ? 'medium'
          : 'medium'

  return {
    overallHealth,
    startupBlocker,
    recommendedFix,
    confidence,
    passCount,
    warningCount,
    failCount
  }
}

/** Run every check sequentially; never abort early. */
export async function runAllDiagnostics(): Promise<DiagnosticsRunResult> {
  clearDiagnoseCache()
  const startedAt = nowIso()
  const t0 = Date.now()
  const checks: DiagnosticCheckResult[] = []
  for (const fn of ALL_CHECKS) {
    checks.push(await fn())
  }
  const finishedAt = nowIso()
  return {
    startedAt,
    finishedAt,
    durationMs: Date.now() - t0,
    checks,
    summary: summarize(checks)
  }
}
