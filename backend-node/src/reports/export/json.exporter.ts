import type {
  ReportExportPayload,
  ReportExportResult,
  ReportExporter,
} from './report-exporter';
import { REPORT_EXPORT_FORMAT } from '../reports.constants';

export class JsonReportExporter implements ReportExporter {
  readonly format = REPORT_EXPORT_FORMAT.JSON;

  export(payload: ReportExportPayload): ReportExportResult {
    const stamp = payload.generatedAt.slice(0, 10);
    const body = JSON.stringify(
      {
        title: payload.title,
        generatedAt: payload.generatedAt,
        meta: payload.meta ?? {},
        columns: payload.columns ?? [],
        rows: payload.rows,
      },
      null,
      2,
    );
    return {
      format: this.format,
      contentType: 'application/json; charset=utf-8',
      filename: `${slug(payload.title)}-${stamp}.json`,
      body,
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
