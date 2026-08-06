import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  Button,
  BusyIndicator,
  EmptyState,
  ErrorState,
  InlineMessage,
  Page,
  PageHeader,
  PermissionGuard
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useDress } from '@/features/inventory/hooks'
import { AvailabilityPanel } from '@/features/inventory/components/AvailabilityPanel'

export default function CalendarDressPage(): React.ReactElement {
  const { dressId } = useParams<{ dressId: string }>()
  const canView = usePermission('calendar.view')
  const navigate = useNavigate()
  const dressQuery = useDress(dressId)

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!dressId) return <Navigate to="/calendar" replace />

  const dress = dressQuery.data?.data

  return (
    <Page size="full" as="main">
      <PageHeader
        title={dress ? `تقويم · ${dress.name_ar}` : 'تقويم الفستان'}
        description={dress?.barcode}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void navigate('/calendar')}>
              اختيار فستان آخر
            </Button>
            <PermissionGuard permission="inventory.view">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigate(`/inventory/${dressId}`)}
              >
                المخزون
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      {dressQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : dressQuery.isError || !dress ? (
        <ErrorState
          title="تعذر تحميل الفستان"
          message="تحقق من الرابط أو الصلاحيات"
          onRetry={() => void dressQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <InlineMessage variant="info">
            واجهة تقويم الكتل غير متاحة في Nest V2 بعد — التوفر يُفرض عند تأكيد الحجز/التأجير على
            الخادم عبر AvailabilityService.
          </InlineMessage>
          <EmptyState
            title="جدول التقويم غير متاح"
            description="لا يوجد مسار HTTP للتقويم في الخادم الحالي. افتح الحجوزات أو التأجير لمتابعة العمل."
          />
          <AvailabilityPanel dressId={dressId} />
        </div>
      )}
    </Page>
  )
}
