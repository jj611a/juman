import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const RentalsListPage = lazy(() => import('./pages/RentalsListPage'))
const RentalDetailPage = lazy(() => import('./pages/RentalDetailPage'))
const RentalCheckoutPage = lazy(() => import('./pages/RentalCheckoutPage'))

export const rentalsRoutes: RouteObject[] = [
  {
    path: 'rentals',
    element: <RentalsListPage />,
    handle: { title: 'التأجير', breadcrumb: { id: 'rentals', label: 'التأجير' } }
  },
  {
    path: 'rentals/new',
    element: <RentalCheckoutPage />,
    handle: { title: 'تأجير جديد', breadcrumb: { id: 'rentals-new', label: 'تأجير جديد' } }
  },
  {
    path: 'rentals/:id',
    element: <RentalDetailPage />,
    handle: { title: 'تفاصيل التأجير', breadcrumb: { id: 'rentals-detail', label: 'تفاصيل' } }
  }
]
