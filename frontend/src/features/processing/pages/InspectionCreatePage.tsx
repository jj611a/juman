import * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  Button,
  EmptyState,
  ErrorState,
  InlineMessage,
  Page,
  PageHeader,
  PermissionGuard,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useReturnsList } from '@/features/returns/hooks'
import type { ReturnDto } from '@/services/domainTypes'
import { useCreateInspection } from '../hooks'

export default function InspectionCreatePage(): React.ReactElement {
  const canCreate = usePermission('inspection.create')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnIdParam = searchParams.get('returnId') ?? ''
  const [selectedReturnId, setSelectedReturnId] = React.useState(returnIdParam)

  const createMutation = useCreateInspection()
  const pendingReturns = useReturnsList({
    status: 'PENDING_INSPECTION',
    limit: 50,
    offset: 0
  })

  React.useEffect(() => {
    if (returnIdParam) setSelectedReturnId(returnIdParam)
  }, [returnIdParam])

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const handleCreate = async (returnId: string): Promise<void> => {
    const result = await createMutation.mutateAsync({ return_id: returnId })
    void navigate(`/processing/inspections/${result.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="فحص جديد" description="إنشاء فحص لمرتجع" />
      {returnIdParam ? (
        <div className="space-y-4">
          <InlineMessage variant="info">
            سيتم إنشاء فحص للمرتجع: <span dir="ltr">{returnIdParam}</span>
          </InlineMessage>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => void handleCreate(returnIdParam)}
            >
              {createMutation.isPending ? 'جاري الإنشاء…' : 'إنشاء الفحص'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void navigate('/processing')}>
              إلغاء
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground">اختر مرتجعاً بانتظار الفحص:</p>
          {pendingReturns.isLoading ? (
            <BusyIndicator label="جاري التحميل…" />
          ) : pendingReturns.isError ? (
            <ErrorState title="تعذر تحميل المرتجعات" onRetry={() => void pendingReturns.refetch()} />
          ) : (pendingReturns.data?.data.length ?? 0) === 0 ? (
            <EmptyState title="لا مرتجعات بانتظار الفحص" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(pendingReturns.data?.data ?? []).map((row: ReturnDto) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{row.return_number}</p>
                    <p className="text-caption text-muted-foreground">
                      {new Date(row.returned_at).toLocaleString('ar-IQ')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={createMutation.isPending && selectedReturnId === row.id}
                    onClick={() => {
                      setSelectedReturnId(row.id)
                      void handleCreate(row.id)
                    }}
                  >
                    {createMutation.isPending && selectedReturnId === row.id
                      ? 'جاري الإنشاء…'
                      : 'اختيار'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <PermissionGuard permission="return.view">
            <Button type="button" variant="outline" onClick={() => void navigate('/returns')}>
              عرض كل المرتجعات
            </Button>
          </PermissionGuard>
        </div>
      )}
    </Page>
  )
}
