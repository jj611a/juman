import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const SizesListPage = lazy(() => import('./pages/ListPage'))

export const sizesRoutes: RouteObject[] = [
  {
    path: 'sizes',
    element: <SizesListPage />,
    handle: {
      title: 'المقاسات',
      breadcrumb: { id: 'sizes', label: 'المقاسات' }
    }
  }
]
