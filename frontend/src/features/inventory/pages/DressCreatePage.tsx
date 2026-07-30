import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Page, PageHeader } from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { DressForm, dateToIso } from '../components/DressForm'
import { useCreateDress } from '../hooks'
import { emptyToNull, type DressFormValues } from '../schemas'

export default function DressCreatePage(): React.ReactElement {
  const canCreate = usePermission('inventory.create')
  const navigate = useNavigate()
  const createMutation = useCreateDress()
  const [dirty, setDirty] = React.useState(false)
  const { dialog } = useUnsavedChangesGuard(dirty)

  if (!canCreate) return <Navigate to="/forbidden" replace />

  const handleSubmit = async (values: DressFormValues): Promise<void> => {
    const created = await createMutation.mutateAsync({
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
      purchase_date: dateToIso(values.purchase_date),
      barcode: emptyToNull(values.barcode),
      is_active: values.is_active
    })
    setDirty(false)
    void navigate(`/inventory/${created.data.id}`)
  }

  return (
    <Page size="md" as="main">
      <PageHeader title="فستان جديد" description="إنشاء أصل فستان جديد" />
      <DressForm
        mode="create"
        submitting={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={() => void navigate('/inventory')}
        onDirtyChange={setDirty}
      />
      {dialog}
    </Page>
  )
}
