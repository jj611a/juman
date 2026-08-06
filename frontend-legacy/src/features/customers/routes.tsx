import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const CustomersListPage = lazy(() => import('./pages/CustomersListPage'))
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'))

export const customersRoutes: RouteObject[] = [
  {
    path: 'customers',
    element: <CustomersListPage />,
    handle: {
      title: 'العملاء',
      breadcrumb: { id: 'customers', label: 'العملاء' }
    }
  },
  {
    path: 'customers/:id',
    element: <CustomerDetailPage />,
    handle: {
      title: 'تفاصيل العميل',
      breadcrumb: { id: 'customer-detail', label: 'تفاصيل العميل' }
    }
  }
]
