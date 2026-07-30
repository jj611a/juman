import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
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
import type { InspectionDto } from '@/services/domainTypes'
import { useInspectionsList } from '../hooks'
import { INSPECTION_STATUS_MAP } from '../statusMap'

export default function InspectionsListPage(): React.ReactElement {
  const canView = usePermission('inspection.view')
  const navigate = useNavigate()
  const [returnIdFilter, setReturnIdFilter] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const statusFilter = filters.find((f) => f.id === 'status')?.value

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      return_id: returnIdFilter.trim() || undefined,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, statusFilter, returnIdFilter, sorting]
  )

  const listQuery = useInspectionsList(listParams)

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(INSPECTION_STATUS_MAP).map(([value, v]) => ({
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
      createDataColumn<InspectionDto>({
        accessorKey: 'inspection_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<InspectionDto>({
        id: 'return_id',
        header: 'المرتجع',
        cell: ({ row }) => (
          <span dir="ltr" className="text-caption">
            {row.return_id.slice(0, 8)}…
          </span>
        )
      }),
      createDataColumn<InspectionDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), INSPECTION_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<InspectionDto>({
        id: 'items',
        header: 'البنود',
        cell: ({ row }) => String(row.items?.length ?? 0)
      }),
      createDataColumn<InspectionDto>({
        id: 'created_at',
        header: 'تاريخ الإنشاء',
        sortable: true,
        cell: ({ row }) => new Date(row.created_at).toLocaleDateString('ar-IQ')
      })
    ],
    []
  )

  const actions = React.useMemo<DataRowAction<InspectionDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'inspection.view',
        onClick: (row) => void navigate(`/processing/inspections/${row.id}`)
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
        title="الفحوصات"
        description="فحص حالة الفساتين بعد الإرجاع"
        actions={
          <PageActions>
            <PermissionGuard permission="inspection.create">
              <Button type="button" onClick={() => void navigate('/processing/inspections/new')}>
                فحص جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <TextInput
              value={returnIdFilter}
              onChange={(e) => {
                setReturnIdFilter(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              placeholder="معرّف المرتجع (return_id)"
            />
            <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          </div>
        }
      />
      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل الفحوصات" onRetry={() => void listQuery.refetch()} />
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
            empty={<EmptyState title="لا فحوصات" description="أنشئ فحصاً للبدء" />}
          />
        </>
      )}
    </Page>
  )
}
