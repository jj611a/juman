import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { BusyIndicator, ErrorState, Page, PageHeader } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { DressForm } from '../components/DressForm'
import { useDress, useUpdateDress } from '../hooks'
import { dateToIso, emptyToNull, type DressFormValues } from '../schemas'

export default function DressEditPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const canUpdate = usePermission('inventory.update')
  const navigate = useNavigate()
  const detail = useDress(id)
  const updateMutation = useUpdateDress(id ?? '')
  const [dirty, setDirty] = React.useState(false)
  const { dialog } = useUnsavedChangesGuard(dirty)

  if (!canUpdate) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/inventory" replace />

  const handleSubmit = async (values: DressFormValues): Promise<void> => {
    await updateMutation.mutateAsync({
      category_id: values.category_id,
      name_ar: values.name_ar,
      name_en: emptyToNull(values.name_en),
      brand: emptyToNull(values.brand),
      size: values.size,
      colour: values.colour,
      purchase_price: values.purchase_price,
      default_daily_rental_price: values.default_daily_rental_price,
      default_sale_price: values.default_sale_price,
      description: emptyToNull(values.description),
      purchase_date: values.clear_purchase_date ? null : dateToIso(values.purchase_date),
      clear_purchase_date: values.clear_purchase_date,
      is_active: values.is_active
    })
    setDirty(false)
    void navigate(`/inventory/${id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="تعديل الفستان" />
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !detail.data ? (
        <ErrorState
          title="تعذر التحميل"
          message="السجل غير متاح"
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <DressForm
          key={detail.data.data.id}
          mode="edit"
          initial={detail.data.data}
          submitting={updateMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => void navigate(`/inventory/${id}`)}
          onDirtyChange={setDirty}
        />
      )}
      {dialog}
    </Page>
  )
}
