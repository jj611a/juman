import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { AppShell } from '@/layouts/shell/AppShell'
import { LoginPage } from '@/features/authentication/LoginPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ShellGuidePage } from '@/features/dashboard/pages/ShellGuidePage'
import { FeaturePlaceholderPage } from '@/features/shell-placeholders/FeaturePlaceholderPage'
import { ROUTES } from '@/shared/constants/routes'
import { PageSkeleton } from '@/shared/components/feedback/PageSkeleton'
import { NAV_ITEMS } from '@/navigation/nav.config'
import { CustomerListPage } from '@/features/customers/pages/CustomerListPage'
import { CustomerDetailPage } from '@/features/customers/pages/CustomerDetailPage'
import { InventoryListPage } from '@/features/inventory/pages/InventoryListPage'
import { InventoryDetailPage } from '@/features/inventory/pages/InventoryDetailPage'
import { ReservationListPage } from '@/features/reservations/pages/ReservationListPage'
import { ReservationDetailPage } from '@/features/reservations/pages/ReservationDetailPage'
import { RentalListPage } from '@/features/rentals/pages/RentalListPage'
import { RentalDetailPage } from '@/features/rentals/pages/RentalDetailPage'
import { POSWorkspace } from '@/features/pos/pages/POSWorkspace'
import { RouteGuard } from '@/features/permissions/RouteGuard'
import { SalesListPage } from '@/features/sales/pages/SalesListPage'
import { SalesDetailPage } from '@/features/sales/pages/SalesDetailPage'
import { FinancePage } from '@/features/finance/pages/FinancePage'
import { SettlementsPage } from '@/features/settlements/pages/SettlementsPage'
import { ReportsPage } from '@/features/reports/pages/ReportsPage'
import { CategoriesPage } from '@/features/categories/pages/CategoriesPage'
import { ReceiptSettingsPage } from '@/features/receipts/pages/ReceiptSettingsPage'
import { EmployeeListPage } from '@/features/employees/pages/EmployeeListPage'
import { EmployeeDetailPage } from '@/features/employees/pages/EmployeeDetailPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <PageSkeleton />
      </div>
    )
  }
  if (!session?.authenticated) return <Navigate to={ROUTES.LOGIN} replace />
  return children
}

function placeholder(path: string) {
  const item = NAV_ITEMS.find((n) => n.to === path)
  return (
    <FeaturePlaceholderPage
      title={item?.label ?? path}
      phase={item?.phase ?? '9.x'}
    />
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="shell" element={<ShellGuidePage />} />
          <Route 
            path="customers" 
            element={
              <RouteGuard permission="customer.view">
                <CustomerListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="customers/:id" 
            element={
              <RouteGuard permission="customer.view">
                <CustomerDetailPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="inventory" 
            element={
              <RouteGuard permission="inventory.view">
                <InventoryListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="inventory/:id" 
            element={
              <RouteGuard permission="inventory.view">
                <InventoryDetailPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="categories" 
            element={
              <RouteGuard permission="categories.view">
                <CategoriesPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="reservations" 
            element={
              <RouteGuard permission="reservation.view">
                <ReservationListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="reservations/:id" 
            element={
              <RouteGuard permission="reservation.view">
                <ReservationDetailPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="rentals" 
            element={
              <RouteGuard permission="rental.view">
                <RentalListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="rentals/:id" 
            element={
              <RouteGuard permission="rental.view">
                <RentalDetailPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="sales" 
            element={
              <RouteGuard permission="sales.view">
                <SalesListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="sales/:id" 
            element={
              <RouteGuard permission="sales.view">
                <SalesDetailPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="pos" 
            element={
              <RouteGuard permission="sales.view">
                <POSWorkspace />
              </RouteGuard>
            } 
          />
          <Route 
            path="finance" 
            element={
              <RouteGuard permission="finance.view">
                <FinancePage />
              </RouteGuard>
            } 
          />
          <Route 
            path="settlements" 
            element={
              <RouteGuard permission="finance.settlement.view">
                <SettlementsPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="reports" 
            element={
              <RouteGuard permission="reports.view">
                <ReportsPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="settings/receipts" 
            element={
              <RouteGuard permission="finance.settlement.view">
                <ReceiptSettingsPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="employees" 
            element={
              <RouteGuard permission="users.view">
                <EmployeeListPage />
              </RouteGuard>
            } 
          />
          <Route 
            path="employees/:id" 
            element={
              <RouteGuard permission="users.view">
                <EmployeeDetailPage />
              </RouteGuard>
            } 
          />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
