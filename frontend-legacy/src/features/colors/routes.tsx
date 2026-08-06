import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const ColorsListPage = lazy(() => import('./pages/ListPage'))

export const colorsRoutes: RouteObject[] = [
  {
    path: 'colors',
    element: <ColorsListPage />,
    handle: {
      title: 'الألوان',
      breadcrumb: { id: 'colors', label: 'الألوان' }
    }
  }
]
