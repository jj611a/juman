import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const CategoriesListPage = lazy(() => import('./pages/CategoriesListPage'))

export const categoriesRoutes: RouteObject[] = [
  {
    path: 'categories',
    element: <CategoriesListPage />,
    handle: {
      title: 'الفئات',
      breadcrumb: { id: 'categories', label: 'الفئات' }
    }
  }
]
