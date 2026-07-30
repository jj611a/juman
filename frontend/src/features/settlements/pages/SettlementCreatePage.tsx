import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  EmptyState,
  ErrorState,
  InlineMessage,
  Page,
  PageHeader,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { toAppError } from '@/lib/errors/appError'
import type { RentalDto } from '@/services/domainTypes'
import { useRentalsList } from '@/features/rentals/hooks'
import { useCreateSettlement } from '../hooks'

export default function SettlementCreatePage(): React.ReactElement {
  const canCreate = usePermission('rental.settlement.create')
  const navigate = useNavigate()
  const [selectedRentalId, setSelectedRentalId] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState('')

  const rentalsQuery = useRentalsList({
    status: 'RETURN_PENDING',
    offset: 0,
    limit: 50,
    sort_by: 'created_at',
    sort_dir: 'desc'
  })

  const createMutation = useCreateSettlement()

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const rentals = rentalsQuery.data?.data ?? []

  const submit = async (): Promise<void> => {
    if (!selectedRentalId) return
    try {
      const res = await createMutation.mutateAsync({
        rental_id: selectedRentalId,
        notes: notes.trim() || null
      })
      void navigate(`/settlements/${res.data.id}`)
    } catch {
      // toast + inline handled below
    }
  }

  return (
    <Page size="md" as="main">
      <PageHeader
        title="تسوية جديدة"
        description="اختر تأجيراً بحالة بانتظار الإرجاع — يجب اكتمال الفحص على الخادم"
      />

      <InlineMessage variant="info">
        المبالغ تُحسب على الخادم عند الإنشاء — لا تُعاد حسابها في الواجهة.
      </InlineMessage>

      {createMutation.isError ? (
        <InlineMessage variant="danger">{toAppError(createMutation.error).message}</InlineMessage>
      ) : null}

      {rentalsQuery.isLoading ? (
        <BusyIndicator label="جاري تحميل التأجيرات…" />
      ) : rentalsQuery.isError ? (
        <ErrorState title="تعذّر تحميل التأجيرات" onRetry={() => void rentalsQuery.refetch()} />
      ) : rentals.length === 0 ? (
        <EmptyState
          title="لا تأجيرات مؤهلة"
          description="يُشترط تأجير RETURN_PENDING مع فحص مكتمل"
        />
      ) : (
        <div className="mt-6 space-y-4">
          <ul className="divide-y divide-border rounded-md border border-border">
            {rentals.map((rental: RentalDto) => (
              <li key={rental.id}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-brand-subtle">
                  <input
                    type="radio"
                    name="rental"
                    className="mt-1"
                    checked={selectedRentalId === rental.id}
                    onChange={() => setSelectedRentalId(rental.id)}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{rental.rental_number}</span>
                    <span className="text-caption text-muted-foreground">
                      {new Date(rental.rental_at).toLocaleDateString('ar-IQ')} —{' '}
                      {rental.customer_id.slice(0, 8)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <TextInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات (اختياري)"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!selectedRentalId || createMutation.isPending}
              onClick={() => void submit()}
            >
              إنشاء التسوية
            </Button>
            <Button type="button" variant="outline" onClick={() => void navigate('/settlements')}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </Page>
  )
}
