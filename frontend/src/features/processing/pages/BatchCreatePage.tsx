import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Label,
  Page,
  PageHeader,
  TextInput,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/apiClient'
import type { InspectionDto, InspectionItemDto } from '@/services/domainTypes'
import { useCreateProcessingBatch, useInspectionsList } from '../hooks'

interface EligibleItem {
  inspection: InspectionDto
  item: InspectionItemDto
}

export default function BatchCreatePage(): React.ReactElement {
  const canCreate = usePermission('processing.create')
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [notes, setNotes] = React.useState('')
  const [enableOptionalDay, setEnableOptionalDay] = React.useState(false)

  const createMutation = useCreateProcessingBatch()
  const completedInspections = useInspectionsList({
    status: 'COMPLETED',
    limit: 100,
    offset: 0
  })

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { limit: 200 }],
    queryFn: () => apiClient.dresses.list({ page: 1, page_size: 200 }),
    enabled: Boolean(completedInspections.data)
  })

  const dressName = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const d of dresses.data?.data ?? []) m.set(d.id, d.name_ar)
    return m
  }, [dresses.data])

  const eligibleItems = React.useMemo<EligibleItem[]>(() => {
    const rows: EligibleItem[] = []
    for (const inspection of completedInspections.data?.data ?? []) {
      for (const item of inspection.items ?? []) {
        if (item.requires_laundry) {
          rows.push({ inspection, item })
        }
      }
    }
    return rows
  }, [completedInspections.data])

  const toggleItem = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (): Promise<void> => {
    const result = await createMutation.mutateAsync({
      inspection_item_ids: Array.from(selectedIds),
      notes: notes.trim() || null,
      enable_optional_day: enableOptionalDay
    })
    void navigate(`/processing/batches/${result.data.id}`)
  }

  if (!canCreate) return <Navigate to="/forbidden" replace />

  return (
    <Page size="md" as="main">
      <PageHeader title="دفعة معالجة جديدة" description="اختر بنود الفحص التي تتطلب غسيلاً" />
      {completedInspections.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : completedInspections.isError ? (
        <ErrorState title="تعذر تحميل الفحوصات" onRetry={() => void completedInspections.refetch()} />
      ) : eligibleItems.length === 0 ? (
        <EmptyState
          title="لا بنود مؤهلة"
          description="لا توجد بنود فحص مكتملة تتطلب غسيلاً"
        />
      ) : (
        <div className="space-y-6">
          <ul className="divide-y divide-border rounded-md border border-border">
            {eligibleItems.map(({ inspection, item }) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <Checkbox
                  id={`item-${item.id}`}
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <Label htmlFor={`item-${item.id}`} className="flex-1 cursor-pointer space-y-1">
                  <p className="font-medium">{dressName.get(item.dress_id) ?? item.dress_id}</p>
                  <p className="text-caption text-muted-foreground">
                    فحص {inspection.inspection_number}
                  </p>
                </Label>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="batch-notes">ملاحظات (اختياري)</Label>
            <TextInput
              id="batch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="enable-optional-day"
              checked={enableOptionalDay}
              onCheckedChange={(v) => setEnableOptionalDay(v === true)}
            />
            <Label htmlFor="enable-optional-day">تفعيل اليوم الاختياري عند البدء</Label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={selectedIds.size === 0 || createMutation.isPending}
              onClick={() => void handleSubmit()}
            >
              {createMutation.isPending ? 'جاري الإنشاء…' : 'إنشاء الدفعة'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void navigate('/processing/batches')}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </Page>
  )
}
