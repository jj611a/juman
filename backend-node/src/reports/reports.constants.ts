export const REPORTS_MODULE = 'reports';

export const REPORT_PERMISSION = {
  VIEW: 'reports.view',
  FINANCIAL_VIEW: 'reports.financial.view',
  EXPORT: 'reports.export',
} as const;

export const REPORT_EXPORT_FORMAT = {
  CSV: 'csv',
  JSON: 'json',
  PDF: 'pdf',
  EXCEL: 'excel',
} as const;

export type ReportExportFormat =
  (typeof REPORT_EXPORT_FORMAT)[keyof typeof REPORT_EXPORT_FORMAT];

export const REPORT_KIND = {
  DASHBOARD: 'dashboard',
  FINANCIAL: 'financial',
  RENTALS_CURRENT: 'rentals.current',
  RENTALS_OVERDUE: 'rentals.overdue',
  RENTALS_RETURNS: 'rentals.returns',
  RENTALS_RESERVATIONS: 'rentals.reservations',
  RENTALS_HISTORY: 'rentals.history',
  INVENTORY_VALUE: 'inventory.value',
  INVENTORY_AVAILABILITY: 'inventory.availability',
  INVENTORY_CATEGORY: 'inventory.category',
  INVENTORY_BRAND: 'inventory.brand',
  INVENTORY_COLOR: 'inventory.color',
  INVENTORY_SIZE: 'inventory.size',
  INVENTORY_LIFECYCLE: 'inventory.lifecycle',
  INVENTORY_RETIRED: 'inventory.retired',
  INVENTORY_MAINTENANCE: 'inventory.maintenance',
  CUSTOMER_RENTALS: 'customer.rentals',
  CUSTOMER_OUTSTANDING: 'customer.outstanding',
  CUSTOMER_PAYMENTS: 'customer.payments',
  CUSTOMER_RESERVATIONS: 'customer.reservations',
} as const;

export type ReportKind = (typeof REPORT_KIND)[keyof typeof REPORT_KIND];

export const REPORT_KIND_VALUES = Object.values(REPORT_KIND);

export const IMPLEMENTED_EXPORT_FORMATS: readonly ReportExportFormat[] = [
  REPORT_EXPORT_FORMAT.CSV,
  REPORT_EXPORT_FORMAT.JSON,
];
