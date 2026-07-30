import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const InventoryListPage = lazy(() => import('./pages/InventoryListPage'))
const DressDetailPage = lazy(() => import('./pages/DressDetailPage'))
const DressCreatePage = lazy(() => import('./pages/DressCreatePage'))
const DressEditPage = lazy(() => import('./pages/DressEditPage'))

export const inventoryRoutes: RouteObject[] = [
  {
    path: 'inventory',
    element: <InventoryListPage />,
    handle: { title: 'المخزون', breadcrumb: { id: 'inventory', label: 'المخزون' } }
  },
  {
    path: 'inventory/new',
    element: <DressCreatePage />,
    handle: { title: 'فستان جديد', breadcrumb: { id: 'inventory-new', label: 'فستان جديد' } }
  },
  {
    path: 'inventory/:id',
    element: <DressDetailPage />,
    handle: { title: 'تفاصيل الفستان', breadcrumb: { id: 'inventory-detail', label: 'تفاصيل' } }
  },
  {
    path: 'inventory/:id/edit',
    element: <DressEditPage />,
    handle: { title: 'تعديل الفستان', breadcrumb: { id: 'inventory-edit', label: 'تعديل' } }
  }
]
