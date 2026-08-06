import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button, InlineMessage, Page, PageHeader } from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'

/**
 * Nest creates settlements on rental checkout — no POST /settlements create.
 * Keep route reachable so old links do not 404; explain and redirect.
 */
export default function SettlementCreatePage(): React.ReactElement {
  const canView = useAnyPermission([
    'rental.settlement.view',
    'finance.settlement.view',
    'rental.settlement.create',
    'finance.settlement.manage'
  ])
  const navigate = useNavigate()

  if (!canView) return <Navigate to="/forbidden" replace />

  return (
    <Page size="md" as="main">
      <PageHeader title="إنشاء تسوية" />
      <InlineMessage variant="warning">
        إنشاء التسوية اليدوي غير مدعوم في Nest V2. تُنشأ التسوية تلقائياً عند تسليم التأجير
        (POST /rentals/:id/checkout أو POST /reservations/:id/checkout).
      </InlineMessage>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={() => void navigate('/settlements')}>
          قائمة التسويات
        </Button>
        <Button type="button" variant="outline" onClick={() => void navigate('/rentals/new')}>
          تأجير جديد
        </Button>
      </div>
    </Page>
  )
}
