import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AuditTimeline,
  Button,
  Checkbox,
  EmptyState,
  EntityHeader,
  ErrorState,
  InlineMessage,
  Label,
  MoneyDisplay,
  MoneyInput,
  Page,
  PermissionGuard,
  RecordInfoPanel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  StatusChip,
  BusyIndicator,
  mapStatus
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { DressConditionCode, InspectionItemDto } from '@/services/domainTypes'
import { useInspection, useInspectionAudit, useUpdateInspection } from '../hooks'
import { DRESS_CONDITION_MAP, INSPECTION_STATUS_MAP } from '../statusMap'

interface ItemDraft {
  id: string
  condition: DressConditionCode | ''
  repair_penalty_amount: number | null
  requires_laundry: boolean
  send_to_ruined: boolean
}

function toDraft(item: InspectionItemDto): ItemDraft {
  return {
    id: item.id,
    condition: (item.condition as DressConditionCode) ?? '',
    repair_penalty_amount: item.repair_penalty_amount,
    requires_laundry: item.requires_laundry,
    send_to_ruined: item.send_to_ruined
  }
}

function applyConditionRules(draft: ItemDraft, condition: DressConditionCode): ItemDraft {
  if (condition === 'GOOD') {
    return {
      ...draft,
      condition,
      repair_penalty_amount: null,
      send_to_ruined: false
    }
  }
  if (condition === 'MINOR_DAMAGE') {
    return {
      ...draft,
      condition,
      requires_laundry: true,
      send_to_ruined: false
    }
  }
  return {
    ...draft,
    condition,
    repair_penalty_amount: null,
    requires_laundry: false,
    send_to_ruined: true
  }
}

function toUpdatePayload(drafts: ItemDraft[]) {
  return drafts
    .filter((d) => d.condition)
    .map((d) => ({
      id: d.id,
      condition: d.condition,
      repair_penalty_amount:
        d.condition === 'MINOR_DAMAGE' ? d.repair_penalty_amount : null,
      requires_laundry: d.requires_laundry,
      send_to_ruined: d.send_to_ruined
    }))
}

export default function InspectionDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const canView = usePermission('inspection.view')
  const canUpdate = usePermission('inspection.update')
  const canAudit = usePermission('audit.view')

  const detail = useInspection(id)
  const audit = useInspectionAudit(id, canAudit)
  const updateMutation = useUpdateInspection(id ?? '')
  const inspection = detail.data?.data
  const isCompleted = inspection?.status === 'COMPLETED'
  const canEdit = canUpdate && !isCompleted

  const [drafts, setDrafts] = React.useState<ItemDraft[]>([])

  React.useEffect(() => {
    if (inspection?.items) {
      setDrafts(inspection.items.map(toDraft))
    }
  }, [inspection])

  const dresses = useQuery({
    queryKey: ['inventory', 'list', { limit: 200 }],
    queryFn: () => apiClient.dresses.list({ page: 1, page_size: 200 }),
    enabled: Boolean(inspection)
  })
  const dressName = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const d of dresses.data?.data ?? []) m.set(d.id, d.name_ar)
    return m
  }, [dresses.data])

  if (!canView) return <Navigate to="/forbidden" replace />
  if (!id) return <Navigate to="/processing/inspections" replace />

  const updateDraft = (itemId: string, patch: Partial<ItemDraft>): void => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== itemId) return d
        const next = { ...d, ...patch }
        if (patch.condition) return applyConditionRules(next, patch.condition as DressConditionCode)
        return next
      })
    )
  }

  const saveDraft = async (): Promise<void> => {
    await updateMutation.mutateAsync({ items: toUpdatePayload(drafts) })
  }

  const complete = async (): Promise<void> => {
    await updateMutation.mutateAsync({ items: toUpdatePayload(drafts), complete: true })
  }

  return (
    <Page size="lg" as="main">
      {detail.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : detail.isError || !inspection ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void detail.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <EntityHeader
            title={inspection.inspection_number}
            description={`مرتجع: ${inspection.return_id.slice(0, 8)}…`}
            status={{
              label: INSPECTION_STATUS_MAP[inspection.status]?.label ?? inspection.status,
              tone: INSPECTION_STATUS_MAP[inspection.status]?.tone ?? 'neutral'
            }}
            actions={
              <PermissionGuard permission="return.view">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void navigate(`/returns/${inspection.return_id}`)}
                >
                  المرتجع المصدر
                </Button>
              </PermissionGuard>
            }
          />

          {isCompleted ? (
            <InlineMessage variant="info">
              الفحص مكتمل — الغرامات معروضة للقراءة فقط ولا يتم تحصيل الدفع من هذه الشاشة.
            </InlineMessage>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-title text-foreground">بنود الفحص</h3>
            {(inspection.items?.length ?? 0) === 0 ? (
              <EmptyState title="لا بنود" />
            ) : (
              <ul className="space-y-4">
                {inspection.items.map((item) => {
                  const draft = drafts.find((d) => d.id === item.id) ?? toDraft(item)
                  const condition = draft.condition || (item.condition as DressConditionCode | '')
                  const mapped = condition
                    ? mapStatus(condition, DRESS_CONDITION_MAP)
                    : null

                  return (
                    <li key={item.id} className="rounded-md border border-border p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{dressName.get(item.dress_id) ?? item.dress_id}</p>
                          <PermissionGuard permission="inventory.view">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void navigate(`/inventory/${item.dress_id}`)}
                            >
                              عرض الفستان
                            </Button>
                          </PermissionGuard>
                        </div>
                        {mapped ? (
                          <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
                        ) : null}
                      </div>

                      {canEdit ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>الحالة</Label>
                            <Select
                              value={draft.condition || undefined}
                              onValueChange={(v) =>
                                updateDraft(item.id, { condition: v as DressConditionCode })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر الحالة" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(DRESS_CONDITION_MAP).map(([value, meta]) => (
                                  <SelectItem key={value} value={value}>
                                    {String(meta.label)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {draft.condition === 'MINOR_DAMAGE' ? (
                            <div className="space-y-2">
                              <Label>غرامة الإصلاح (فلس)</Label>
                              <MoneyInput
                                value={draft.repair_penalty_amount}
                                onChange={(fils) =>
                                  updateDraft(item.id, { repair_penalty_amount: fils })
                                }
                              />
                            </div>
                          ) : null}

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`laundry-${item.id}`}
                              checked={draft.requires_laundry}
                              disabled={
                                draft.condition === 'MINOR_DAMAGE' ||
                                draft.condition === 'MAJOR_DAMAGE'
                              }
                              onCheckedChange={(v) =>
                                updateDraft(item.id, { requires_laundry: v === true })
                              }
                            />
                            <Label htmlFor={`laundry-${item.id}`}>يتطلب غسيل</Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`ruined-${item.id}`}
                              checked={draft.send_to_ruined}
                              disabled={draft.condition !== 'MAJOR_DAMAGE'}
                              onCheckedChange={(v) =>
                                updateDraft(item.id, { send_to_ruined: v === true })
                              }
                            />
                            <Label htmlFor={`ruined-${item.id}`}>إرسال إلى التالف</Label>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 text-caption">
                          <p>
                            الحالة:{' '}
                            {mapped?.label ?? item.condition ?? '—'}
                          </p>
                          {item.condition === 'MINOR_DAMAGE' && item.repair_penalty_amount != null ? (
                            <p>
                              غرامة الإصلاح: <MoneyDisplay value={item.repair_penalty_amount} />
                            </p>
                          ) : null}
                          <p>يتطلب غسيل: {item.requires_laundry ? 'نعم' : 'لا'}</p>
                          <p>إرسال إلى التالف: {item.send_to_ruined ? 'نعم' : 'لا'}</p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => void saveDraft()}
                >
                  حفظ المسودة
                </Button>
                <Button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => void complete()}
                >
                  إكمال الفحص
                </Button>
              </div>
            ) : null}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-3">
              <h3 className="text-title text-foreground">سجل التدقيق</h3>
              {!canAudit ? (
                <InlineMessage variant="info">لا تملك صلاحية عرض سجل التدقيق</InlineMessage>
              ) : audit.isError ? (
                <InlineMessage variant="warning">تعذر تحميل سجل التدقيق</InlineMessage>
              ) : audit.isLoading ? (
                <BusyIndicator label="جاري التحميل…" />
              ) : (audit.data?.data.length ?? 0) === 0 ? (
                <EmptyState title="لا أحداث" />
              ) : (
                <AuditTimeline
                  items={(audit.data?.data ?? []).map((row) => ({
                    id: row.id,
                    at: row.created_at,
                    actor: row.username ?? undefined,
                    action: row.action,
                    detail: row.message ?? undefined
                  }))}
                />
              )}
            </section>

            <RecordInfoPanel
              title="معلومات الفحص"
              metaItems={[
                {
                  id: 'status',
                  label: 'الحالة',
                  value: <StatusChip status={inspection.status} map={INSPECTION_STATUS_MAP} />
                },
                {
                  id: 'inspected_at',
                  label: 'تاريخ الفحص',
                  value: inspection.inspected_at
                    ? new Date(inspection.inspected_at).toLocaleString('ar-IQ')
                    : '—'
                }
              ]}
              createdUpdated={{
                createdAt: inspection.created_at,
                updatedAt: inspection.updated_at
              }}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
