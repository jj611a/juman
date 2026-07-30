import { lazy } from 'react'
import type { RouteObject } from 'react-router'

const HardwarePage = lazy(() => import('./pages/HardwarePage'))
const HardwareDiagnosticsPage = lazy(() => import('./pages/HardwareDiagnosticsPage'))

export const hardwareRoutes: RouteObject[] = [
  {
    path: 'hardware',
    element: <HardwarePage />,
    handle: {
      title: 'الأجهزة',
      breadcrumb: { id: 'hardware', label: 'الأجهزة' }
    }
  },
  {
    path: 'hardware/diagnostics',
    element: <HardwareDiagnosticsPage />,
    handle: {
      title: 'تشخيص الأجهزة',
      breadcrumb: { id: 'hardware-diagnostics', label: 'تشخيص الأجهزة' }
    }
  }
]
