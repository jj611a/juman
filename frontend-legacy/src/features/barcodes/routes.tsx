import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const BarcodesPage = lazy(() => import('./pages/BarcodesPage'))

export const barcodesRoutes: RouteObject[] = [
  {
    path: 'barcodes',
    element: <BarcodesPage />,
    handle: {
      title: 'الباركود',
      breadcrumb: { id: 'barcodes', label: 'الباركود' }
    }
  }
]
