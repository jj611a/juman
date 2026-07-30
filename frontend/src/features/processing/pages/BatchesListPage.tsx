import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  StatusBadge,
  TextInput,
  mapStatus,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type DataSortingState,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { ProcessingBatchDto } from '@/services/domainTypes'
import { useProcessingList } from '../hooks'
import { PROCESSING_STATUS_MAP } from '../statusMap'

export default function BatchesListPage(): React.ReactElement {
  const canView = usePermission('processing.view')
  const navigate = useNavigate()
  const [barcodeInput, setBarcodeInput] = React.useState('')
  const [dressIdFilter, setDressIdFilter] = React.useState<string | undefined>()
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const dressLookup = useQuery({
    queryKey: ['inventory', 'barcode', barcodeInput],
    queryFn: () => apiClient.dresses.getByBarcode(barcodeInput.trim()),
    enabled: barcodeInput.trim().length >= 3,
    retry: false
  })

  React.useEffect(() => {
    if (dressLookup.data?.data?.id) {
      setDressIdFilter(dressLookup.data.data.id)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    }
  }, [dressLookup.data])

  const statusFilter = filters.find((f) => f.id === 'status')?.value

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      dress_id: dressIdFilter,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, statusFilter, dressIdFilter, sorting]
  )

  const listQuery = useProcessingList(listParams)

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(PROCESSING_STATUS_MAP).map(([value, v]) => ({
            value,
            label: String(v.label)
          }))
        ]
      }
    ],
    []
  )

  const columns = React.useMemo(
    () => [
      createDataColumn<ProcessingBatchDto>({
        accessorKey: 'processing_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<ProcessingBatchDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), PROCESSING_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<ProcessingBatchDto>({
        id: 'items',
        header: 'البنود',
        cell: ({ row }) => String(row.items?.length ?? 0)
      }),
      createDataColumn<ProcessingBatchDto>({
        id: 'started_at',
        header: 'بدء المعالجة',
        cell: ({ row }) =>
          row.started_at ? new Date(row.started_at).toLocaleDateString('ar-IQ') : '—'
      }),
      createDataColumn<ProcessingBatchDto>({
        id: 'created_at',
        header: 'تاريخ الإنشاء',
        sortable: true,
        cell: ({ row }) => new Date(row.created_at).toLocaleDateString('ar-IQ')
      })
    ],
    []
  )

  const actions = React.useMemo<DataRowAction<ProcessingBatchDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'processing.view',
        onClick: (row) => void navigate(`/processing/batches/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1)

  return (
    <Page size="full" as="main">
      <PageHeader
        title="دفعات المعالجة"
        description="غسيل ومعالجة الفساتين بعد الفحص"
        actions={
          <PageActions>
            <PermissionGuard permission="processing.create">
              <Button type="button" onClick={() => void navigate('/processing/batches/new')}>
                دفعة جديدة
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <TextInput
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeInput(e.target.value)
                if (!e.target.value.trim()) {
                  setDressIdFilter(undefined)
                  setPagination((p) => ({ ...p, pageIndex: 0 }))
                }
              }}
              placeholder="باركود الفستان (اختياري)"
            />
            {dressIdFilter ? (
              <p className="text-caption text-muted-foreground">
                تصفية حسب فستان: <span dir="ltr">{dressIdFilter.slice(0, 8)}…</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ms-2"
                  onClick={() => {
                    setBarcodeInput('')
                    setDressIdFilter(undefined)
                    setPagination((p) => ({ ...p, pageIndex: 0 }))
                  }}
                >
                  مسح
                </Button>
              </p>
            ) : null}
            <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          </div>
        }
      />
      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل الدفعات" onRetry={() => void listQuery.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            manual
            loading={listQuery.isLoading || listQuery.isFetching}
            sorting={sorting}
            onSortingChange={(next) => {
              setSorting(next)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            totalItems={total}
            actions={actions}
            empty={<EmptyState title="لا دفعات" description="أنشئ دفعة للبدء" />}
          />
        </>
      )}
    </Page>
  )
}
