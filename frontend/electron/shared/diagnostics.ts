/** Shared types for Production Diagnostics & Recovery Center. */

export type DiagnosticStatus = 'PASS' | 'WARNING' | 'FAIL'

export type DiagnosticCheckId =
  | 'app_info'
  | 'configuration'
  | 'filesystem'
  | 'postgresql'
  | 'database'
  | 'alembic'
  | 'backend'
  | 'electron_backend'
  | 'ports'
  | 'permissions'
  | 'hardware'

export interface DiagnosticCheckResult {
  id: DiagnosticCheckId
  title: string
  titleAr: string
  status: DiagnosticStatus
  durationMs: number
  timestamp: string
  details: string
  error?: string
  evidence: Record<string, unknown>
}

export interface DiagnosticsSummary {
  overallHealth: DiagnosticStatus
  startupBlocker: string | null
  recommendedFix: string | null
  confidence: 'high' | 'medium' | 'low'
  passCount: number
  warningCount: number
  failCount: number
}

export interface DiagnosticsRunResult {
  startedAt: string
  finishedAt: string
  durationMs: number
  checks: DiagnosticCheckResult[]
  summary: DiagnosticsSummary
}

export type DiagnosticLogSource =
  | 'electron-main'
  | 'backend'
  | 'installer'
  | 'postgresql'
  | 'service'
  | 'repair'

export interface DiagnosticLogChunk {
  source: DiagnosticLogSource
  path?: string
  content: string
  truncated: boolean
}

export type DiagnosticRepairActionId =
  | 'restart_services'
  | 'restart_postgresql'
  | 'restart_backend'
  | 'repair_services'
  | 'rerun_migrations'
  | 'repair_acls'
  | 'repair_config_dirs'
  | 'test_db_connection'
  | 'open_logs'
  | 'open_storage'
  | 'open_config'

export interface DiagnosticRepairResult {
  actionId: DiagnosticRepairActionId
  ok: boolean
  message: string
  error?: string
  stdout?: string
  stderr?: string
}

export interface DiagnosticsReportResult {
  ok: boolean
  path: string
  error?: string
}
