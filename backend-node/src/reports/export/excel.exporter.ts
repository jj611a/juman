import { BusinessException } from '../../shared/errors/business.exception';
import type {
  ReportExportPayload,
  ReportExportResult,
  ReportExporter,
} from './report-exporter';
import { REPORT_EXPORT_FORMAT } from '../reports.constants';

/** Adapter stub — Excel not implemented in Phase 7.0. */
export class ExcelReportExporter implements ReportExporter {
  readonly format = REPORT_EXPORT_FORMAT.EXCEL;

  export(_payload: ReportExportPayload): ReportExportResult {
    void _payload;
    throw BusinessException.validation(
      'Excel export adapter is not implemented yet',
    );
  }
}
