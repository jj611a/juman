import { describe, expect, it } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { CsvReportExporter } from '../src/reports/export/csv.exporter';
import { ExcelReportExporter } from '../src/reports/export/excel.exporter';
import { JsonReportExporter } from '../src/reports/export/json.exporter';
import { PdfReportExporter } from '../src/reports/export/pdf.exporter';
import { ReportExportRegistry } from '../src/reports/export/export.registry';
import { REPORT_EXPORT_FORMAT } from '../src/reports/reports.constants';

const payload = {
  title: 'Dashboard Summary',
  generatedAt: '2026-08-03T12:00:00.000Z',
  columns: ['metric', 'value'],
  rows: [
    { metric: 'active', value: 3 },
    { metric: 'needs,quote', value: 'a"b' },
  ],
  meta: { kind: 'dashboard' },
};

describe('Report exporters', () => {
  it('exports CSV with escaping', () => {
    const result = new CsvReportExporter().export(payload);
    expect(result.format).toBe(REPORT_EXPORT_FORMAT.CSV);
    expect(result.contentType).toContain('text/csv');
    expect(result.filename).toContain('dashboard-summary');
    expect(result.body).toContain('metric,value');
    expect(result.body).toContain('"needs,quote"');
    expect(result.body).toContain('"a""b"');
  });

  it('infers CSV columns from rows when omitted', () => {
    const result = new CsvReportExporter().export({
      title: 'X',
      generatedAt: '2026-08-03T00:00:00.000Z',
      rows: [{ a: 1, b: 2 }],
    });
    expect(result.body).toBe('a,b\n1,2');
  });

  it('exports empty CSV header when no rows or columns', () => {
    const result = new CsvReportExporter().export({
      title: 'Empty',
      generatedAt: '2026-08-03T00:00:00.000Z',
      rows: [],
    });
    expect(result.body).toBe('');
  });

  it('escapes null CSV cells and empty titles', () => {
    const result = new CsvReportExporter().export({
      title: '!!!',
      generatedAt: '2026-08-03T00:00:00.000Z',
      columns: ['a'],
      rows: [{ a: null }],
    });
    expect(result.body).toBe('a\n');
    expect(result.filename.startsWith('report-')).toBe(true);
  });

  it('exports JSON document', () => {
    const result = new JsonReportExporter().export(payload);
    expect(result.format).toBe(REPORT_EXPORT_FORMAT.JSON);
    const parsed = JSON.parse(String(result.body));
    expect(parsed.title).toBe('Dashboard Summary');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.meta.kind).toBe('dashboard');
  });

  it('PDF and Excel adapters remain stubs', () => {
    expect(() => new PdfReportExporter().export(payload)).toThrow(
      BusinessException,
    );
    expect(() => new ExcelReportExporter().export(payload)).toThrow(
      BusinessException,
    );
  });

  it('registry routes formats and rejects unknown', () => {
    const registry = new ReportExportRegistry();
    expect(registry.implementedFormats()).toEqual(['csv', 'json']);
    expect(registry.export('json', payload).format).toBe('json');
    expect(() => registry.export('xml', payload)).toThrow(BusinessException);
    expect(() => registry.export('pdf', payload)).toThrow(BusinessException);
  });
});
