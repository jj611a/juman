import * as React from 'react'
import { Link } from 'react-router'
import { Button, InlineMessage } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'

const ACTIONS: Array<{ label: string; to: string; permission: string }> = [
  { label: 'حجز جديد', to: '/reservations/new', permission: 'reservation.create' },
  { label: 'تأجير جديد', to: '/rentals/new', permission: 'rental.create' },
  { label: 'مرتجع', to: '/returns/new', permission: 'return.create' },
  { label: 'عميل جديد', to: '/customers', permission: 'customer.create' },
  { label: 'فستان جديد', to: '/inventory/new', permission: 'inventory.create' },
  { label: 'التقارير', to: '/reports', permission: 'reports.view' }
]

export function DashboardQuickActions(): React.ReactElement {
  const hasReservation = usePermission('reservation.create')
  const hasRental = usePermission('rental.create')
  const hasReturn = usePermission('return.create')
  const hasCustomer = usePermission('customer.create')
  const hasInventory = usePermission('inventory.create')
  const hasReports = usePermission('reports.view')

  const allowed = new Set(
    [
      hasReservation ? 'reservation.create' : null,
      hasRental ? 'rental.create' : null,
      hasReturn ? 'return.create' : null,
      hasCustomer ? 'customer.create' : null,
      hasInventory ? 'inventory.create' : null,
      hasReports ? 'reports.view' : null
    ].filter(Boolean) as string[]
  )

  const visible = ACTIONS.filter((a) => allowed.has(a.permission))

  return (
    <section aria-labelledby="dash-actions-heading" className="space-y-3">
      <h2 id="dash-actions-heading" className="text-title text-foreground">
        إجراءات سريعة
      </h2>
      {visible.length === 0 ? (
        <InlineMessage variant="info">لا توجد إجراءات متاحة لصلاحياتك</InlineMessage>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((action) => (
            <Button key={action.to} asChild variant="outline" className="justify-start">
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
