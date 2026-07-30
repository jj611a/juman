import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const ReservationsListPage = lazy(() => import('./pages/ReservationsListPage'))
const ReservationDetailPage = lazy(() => import('./pages/ReservationDetailPage'))
const ReservationWizardPage = lazy(() => import('./pages/ReservationWizardPage'))
const ReservationEditPage = lazy(() => import('./pages/ReservationEditPage'))

export const reservationsRoutes: RouteObject[] = [
  {
    path: 'reservations',
    element: <ReservationsListPage />,
    handle: { title: 'الحجوزات', breadcrumb: { id: 'reservations', label: 'الحجوزات' } }
  },
  {
    path: 'reservations/new',
    element: <ReservationWizardPage />,
    handle: { title: 'حجز جديد', breadcrumb: { id: 'reservations-new', label: 'حجز جديد' } }
  },
  {
    path: 'reservations/:id',
    element: <ReservationDetailPage />,
    handle: { title: 'تفاصيل الحجز', breadcrumb: { id: 'reservations-detail', label: 'تفاصيل' } }
  },
  {
    path: 'reservations/:id/edit',
    element: <ReservationEditPage />,
    handle: { title: 'تعديل الحجز', breadcrumb: { id: 'reservations-edit', label: 'تعديل' } }
  }
]
