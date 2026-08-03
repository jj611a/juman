import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../shared/errors/business.exception';
import { CsvReportExporter } from './csv.exporter';
import { ExcelReportExporter } from './excel.exporter';
import { JsonReportExporter } from './json.exporter';
import { PdfReportExporter } from './pdf.exporter';
import type {
  ReportExportPayload,
  ReportExportResult,
  ReportExporter,
} from './report-exporter';
import {
  IMPLEMENTED_EXPORT_FORMATS,
  REPORT_EXPORT_FORMAT,
  type ReportExportFormat,
} from '../reports.constants';

@Injectable()
export class ReportExportRegistry {
  private readonly exporters: Map<string, ReportExporter>;

  constructor() {
    const list: ReportExporter[] = [
      new CsvReportExporter(),
      new JsonReportExporter(),
      new PdfReportExporter(),
      new ExcelReportExporter(),
    ];
    this.exporters = new Map(list.map((e) => [e.format, e]));
  }

  export(
    format: string,
    payload: ReportExportPayload,
  ): ReportExportResult {
    const key = format.trim().toLowerCase() as ReportExportFormat;
    const exporter = this.exporters.get(key);
    if (!exporter) {
      throw BusinessException.validation(
        `Unsupported export format: ${format}`,
      );
    }
    if (
      (key === REPORT_EXPORT_FORMAT.PDF ||
        key === REPORT_EXPORT_FORMAT.EXCEL) &&
      !IMPLEMENTED_EXPORT_FORMATS.includes(key)
    ) {
      // stubs throw from exporter.export
    }
    return exporter.export(payload);
  }

  implementedFormats(): readonly string[] {
    return IMPLEMENTED_EXPORT_FORMATS;
  }
}
