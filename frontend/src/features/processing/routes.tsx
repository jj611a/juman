import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const ProcessingDashboardPage = lazy(() => import('./pages/ProcessingDashboardPage'))
const InspectionsListPage = lazy(() => import('./pages/InspectionsListPage'))
const InspectionCreatePage = lazy(() => import('./pages/InspectionCreatePage'))
const InspectionDetailPage = lazy(() => import('./pages/InspectionDetailPage'))
const BatchesListPage = lazy(() => import('./pages/BatchesListPage'))
const BatchCreatePage = lazy(() => import('./pages/BatchCreatePage'))
const BatchDetailPage = lazy(() => import('./pages/BatchDetailPage'))

export const processingRoutes: RouteObject[] = [
  {
    path: 'processing',
    element: <ProcessingDashboardPage />,
    handle: { title: 'المعالجة', breadcrumb: { id: 'processing', label: 'المعالجة' } }
  },
  {
    path: 'processing/inspections',
    element: <InspectionsListPage />,
    handle: { title: 'الفحوصات', breadcrumb: { id: 'inspections', label: 'الفحوصات' } }
  },
  {
    path: 'processing/inspections/new',
    element: <InspectionCreatePage />,
    handle: { title: 'فحص جديد', breadcrumb: { id: 'inspections-new', label: 'فحص جديد' } }
  },
  {
    path: 'processing/inspections/:id',
    element: <InspectionDetailPage />,
    handle: { title: 'تفاصيل الفحص', breadcrumb: { id: 'inspections-detail', label: 'تفاصيل' } }
  },
  {
    path: 'processing/batches',
    element: <BatchesListPage />,
    handle: { title: 'دفعات المعالجة', breadcrumb: { id: 'batches', label: 'الدفعات' } }
  },
  {
    path: 'processing/batches/new',
    element: <BatchCreatePage />,
    handle: { title: 'دفعة جديدة', breadcrumb: { id: 'batches-new', label: 'دفعة جديدة' } }
  },
  {
    path: 'processing/batches/:id',
    element: <BatchDetailPage />,
    handle: { title: 'تفاصيل الدفعة', breadcrumb: { id: 'batches-detail', label: 'تفاصيل' } }
  }
]
