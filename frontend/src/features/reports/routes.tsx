import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const ReportsHomePage = lazy(() => import('./pages/ReportsHomePage'))
const DashboardReportPage = lazy(() => import('./pages/DashboardReportPage'))
const InventoryReportPage = lazy(() => import('./pages/InventoryReportPage'))
const RentalsReportPage = lazy(() => import('./pages/RentalsReportPage'))
const ReservationsReportPage = lazy(() => import('./pages/ReservationsReportPage'))
const CustomersReportPage = lazy(() => import('./pages/CustomersReportPage'))
const InspectionsReportPage = lazy(() => import('./pages/InspectionsReportPage'))
const ProcessingReportPage = lazy(() => import('./pages/ProcessingReportPage'))
const SalesReportPage = lazy(() => import('./pages/SalesReportPage'))
const FinancialReportPage = lazy(() => import('./pages/FinancialReportPage'))

export const reportsRoutes: RouteObject[] = [
  {
    path: 'reports',
    element: <ReportsHomePage />,
    handle: { title: 'التقارير', breadcrumb: { id: 'reports', label: 'التقارير' } }
  },
  {
    path: 'reports/dashboard',
    element: <DashboardReportPage />,
    handle: { title: 'لوحة التقارير', breadcrumb: { id: 'reports-dashboard', label: 'لوحة التشغيل' } }
  },
  {
    path: 'reports/inventory',
    element: <InventoryReportPage />,
    handle: { title: 'تقرير المخزون', breadcrumb: { id: 'reports-inventory', label: 'المخزون' } }
  },
  {
    path: 'reports/rentals',
    element: <RentalsReportPage />,
    handle: { title: 'تقرير الإيجارات', breadcrumb: { id: 'reports-rentals', label: 'الإيجارات' } }
  },
  {
    path: 'reports/reservations',
    element: <ReservationsReportPage />,
    handle: { title: 'تقرير الحجوزات', breadcrumb: { id: 'reports-reservations', label: 'الحجوزات' } }
  },
  {
    path: 'reports/customers',
    element: <CustomersReportPage />,
    handle: { title: 'تقرير العملاء', breadcrumb: { id: 'reports-customers', label: 'العملاء' } }
  },
  {
    path: 'reports/inspections',
    element: <InspectionsReportPage />,
    handle: { title: 'تقرير الفحوصات', breadcrumb: { id: 'reports-inspections', label: 'الفحوصات' } }
  },
  {
    path: 'reports/processing',
    element: <ProcessingReportPage />,
    handle: { title: 'تقرير المعالجة', breadcrumb: { id: 'reports-processing', label: 'المعالجة' } }
  },
  {
    path: 'reports/sales',
    element: <SalesReportPage />,
    handle: { title: 'تقرير المبيعات', breadcrumb: { id: 'reports-sales', label: 'المبيعات' } }
  },
  {
    path: 'reports/financial',
    element: <FinancialReportPage />,
    handle: { title: 'التقرير المالي', breadcrumb: { id: 'reports-financial', label: 'المالي' } }
  }
]
