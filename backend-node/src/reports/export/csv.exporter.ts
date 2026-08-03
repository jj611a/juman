import type {
  ReportExportPayload,
  ReportExportResult,
  ReportExporter,
} from './report-exporter';
import { REPORT_EXPORT_FORMAT } from '../reports.constants';

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export class CsvReportExporter implements ReportExporter {
  readonly format = REPORT_EXPORT_FORMAT.CSV;

  export(payload: ReportExportPayload): ReportExportResult {
    const columns =
      payload.columns?.length
        ? [...payload.columns]
        : payload.rows.length > 0
          ? Object.keys(payload.rows[0]!)
          : [];
    const lines: string[] = [];
    lines.push(columns.map(escapeCsv).join(','));
    for (const row of payload.rows) {
      lines.push(columns.map((c) => escapeCsv(row[c])).join(','));
    }
    const stamp = payload.generatedAt.slice(0, 10);
    return {
      format: this.format,
      contentType: 'text/csv; charset=utf-8',
      filename: `${slug(payload.title)}-${stamp}.csv`,
      body: lines.join('\n'),
    };
  }
}

function slug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'report';
}
