/**
 * Read-only export abstraction (Phase 7.0).
 * Implementations must never mutate domain data.
 */

export type ReportExportPayload = {
  readonly title: string;
  readonly generatedAt: string;
  readonly columns?: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly meta?: Record<string, unknown>;
};

export type ReportExportResult = {
  readonly format: string;
  readonly contentType: string;
  readonly filename: string;
  readonly body: string | Buffer;
};

export interface ReportExporter {
  readonly format: string;
  export(payload: ReportExportPayload): ReportExportResult;
}
