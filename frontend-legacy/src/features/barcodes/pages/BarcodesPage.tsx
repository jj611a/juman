import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  Button,
  EmptyState,
  ErrorState,
  InlineMessage,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  TextInput
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import {
  useBarcodesList,
  useGenerateBarcode,
  useReleaseBarcode,
  useReserveBarcode,
  useRetireBarcode,
  useValidateBarcode
} from '../hooks'

export default function BarcodesPage(): React.ReactElement {
  const canView = usePermission('barcode.view')
  const [q, setQ] = React.useState('')
  const [actionValue, setActionValue] = React.useState('')
  const [validateResult, setValidateResult] = React.useState<string | null>(null)

  const list = useBarcodesList({ q: q || undefined, limit: 50, offset: 0 })
  const generate = useGenerateBarcode()
  const reserve = useReserveBarcode()
  const validate = useValidateBarcode()
  const release = useReleaseBarcode()
  const retire = useRetireBarcode()

  const trimmed = actionValue.trim()

  if (!canView) return <Navigate to="/forbidden" replace />

  return (
    <Page size="lg" as="main">
      <PageHeader
        title="الباركود"
        description="عرض وتوليد وحجز وتحرير الباركودات"
        actions={
          <PageActions>
            <PermissionGuard permission="barcode.generate">
              <Button
                type="button"
                disabled={generate.isPending}
                onClick={() => void generate.mutateAsync({})}
              >
                توليد
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="barcode.reserve">
              <Button
                type="button"
                variant="secondary"
                disabled={reserve.isPending}
                onClick={() => void reserve.mutateAsync(trimmed ? { value: trimmed } : {})}
              >
                حجز
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="barcode.view">
              <Button
                type="button"
                variant="outline"
                disabled={!trimmed || validate.isPending}
                onClick={async () => {
                  const res = await validate.mutateAsync({ value: trimmed })
                  setValidateResult(JSON.stringify(res))
                }}
              >
                تحقق
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="barcode.release">
              <Button
                type="button"
                variant="outline"
                disabled={!trimmed || release.isPending}
                onClick={() => void release.mutateAsync({ value: trimmed })}
              >
                تحرير
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="barcode.retire">
              <Button
                type="button"
                variant="danger"
                disabled={!trimmed || retire.isPending}
                onClick={() => void retire.mutateAsync({ value: trimmed })}
              >
                إبطال
              </Button>
            </PermissionGuard>
          </PageActions>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث…"
          className="max-w-xs"
        />
        <TextInput
          value={actionValue}
          onChange={(e) => setActionValue(e.target.value)}
          placeholder="قيمة للإجراء…"
          className="max-w-xs"
          dir="ltr"
        />
      </div>
      {validateResult ? <InlineMessage variant="info">{validateResult}</InlineMessage> : null}

      {list.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : list.isError ? (
        <ErrorState title="تعذر التحميل" onRetry={() => void list.refetch()} />
      ) : (list.data?.data.length ?? 0) === 0 ? (
        <EmptyState title="لا باركودات" description="ولّد باركوداً للبدء" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(list.data?.data ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p dir="ltr" className="font-mono">
                  {b.value}
                </p>
                <p className="text-caption text-muted-foreground">
                  {b.status}
                  {b.entityId ? ` · ${b.entityType}:${b.entityId.slice(0, 8)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <PermissionGuard permission="barcode.release">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={release.isPending}
                    onClick={() => void release.mutateAsync({ value: b.value })}
                  >
                    تحرير
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="barcode.retire">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={retire.isPending}
                    onClick={() => void retire.mutateAsync({ value: b.value })}
                  >
                    إبطال
                  </Button>
                </PermissionGuard>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
