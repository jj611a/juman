import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const BrandsListPage = lazy(() => import('./pages/ListPage'))

export const brandsRoutes: RouteObject[] = [
  {
    path: 'brands',
    element: <BrandsListPage />,
    handle: {
      title: 'العلامات',
      breadcrumb: { id: 'brands', label: 'العلامات' }
    }
  }
]
